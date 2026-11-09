/**
 * 用 headless Chrome 跑一次 browser-worker:
 * 渲染 mermaid 图 + 压缩内联图片, 然后把结果读回来.
 *
 * 流程: 临时目录里写 index.html / payload.js / worker.js →
 * `--dump-dom` 拿到最终 DOM → 解析 <pre id="mdr-result"> 里的 base64 JSON.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface BrowserPassPayload {
  mermaid: string[]
  mermaidTheme: 'default' | 'dark'
  images: { id: string; dataUrl: string }[]
}

export interface MermaidOutcome {
  svg?: string
  error?: string
}

export interface BrowserPassResult {
  mermaid: MermaidOutcome[]
  images: { id: string; dataUrl: string }[]
}

export interface BrowserPassOptions {
  /** 浏览器可执行文件路径, 用 findBrowser() 探测 */
  browser: string
  /** 真实时间上限, 默认 60s */
  timeoutMs?: number
}

const MAC_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi',
  '/Applications/Arc.app/Contents/MacOS/Arc',
]

const LINUX_CANDIDATES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'microsoft-edge',
  'brave-browser',
]

/**
 * 找一个可用的 Chromium 系浏览器.
 * 优先级: 显式传入 > 环境变量 MDR_CHROME > 平台常见安装位置.
 */
export function findBrowser(explicit?: string): string | null {
  const requested = explicit ?? process.env.MDR_CHROME
  if (requested) return existsSync(requested) ? requested : null

  if (process.platform === 'darwin') {
    for (const candidate of MAC_CANDIDATES) {
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  if (process.platform === 'linux') {
    for (const name of LINUX_CANDIDATES) {
      const found = Bun.which(name)
      if (found) return found
    }
  }
  return null
}

let cachedWorkerBundle: string | null = null

async function bundleWorker(): Promise<string> {
  if (cachedWorkerBundle) return cachedWorkerBundle
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, 'browser-worker.ts')],
    target: 'browser',
    format: 'iife',
    minify: true,
  })
  if (!result.success || result.outputs.length === 0) {
    throw new Error(`打包浏览器 worker 失败:\n${result.logs.map((log) => String(log)).join('\n')}`)
  }
  cachedWorkerBundle = await result.outputs[0]!.text()
  return cachedWorkerBundle
}

function resolveMermaidScript(): string {
  try {
    return Bun.resolveSync('mermaid/dist/mermaid.min.js', import.meta.dir)
  } catch {
    throw new Error('找不到 mermaid 依赖 (node_modules/mermaid/dist/mermaid.min.js), 请先安装依赖')
  }
}

function buildWorkerHtml(options: { mermaidUrl: string; payloadUrl: string; workerUrl: string }): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>md-export worker</title></head>
<body>
<script src="${options.mermaidUrl}"></script>
<script src="${options.payloadUrl}"></script>
<script src="${options.workerUrl}"></script>
</body>
</html>
`
}

function tail(text: string, max = 600): string {
  const trimmed = text.trim()
  return trimmed.length <= max ? trimmed : `…${trimmed.slice(-max)}`
}

function dumpDom(browser: string, htmlPath: string, workDir: string, timeoutMs: number): Promise<string> {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--hide-scrollbars',
    `--user-data-dir=${join(workDir, 'profile')}`,
    '--virtual-time-budget=20000',
    '--dump-dom',
    pathToFileURL(htmlPath).href,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`headless 浏览器超时 (${timeoutMs}ms)${stderr ? `\n${tail(stderr)}` : ''}`))
    }, timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`无法启动浏览器 ${browser}: ${error.message}`))
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!stdout.includes('mdr-result')) {
        reject(
          new Error(
            `headless 浏览器没有返回结果 (exit ${code})${stderr ? `\n${tail(stderr)}` : ''}`,
          ),
        )
        return
      }
      resolve(stdout)
    })
  })
}

function parseResult(dump: string): BrowserPassResult {
  const match = /<pre[^>]*id="mdr-result"[^>]*>([\s\S]*?)<\/pre>/.exec(dump)
  if (!match) throw new Error('页面里没有找到导出结果 (mdr-result)')

  const base64 = (match[1] ?? '').replace(/\s+/g, '')
  let json: string
  try {
    json = Buffer.from(base64, 'base64').toString('utf8')
  } catch {
    throw new Error('导出结果不是合法的 base64')
  }

  let parsed: { mermaid?: MermaidOutcome[]; images?: BrowserPassResult['images']; error?: string }
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('导出结果不是合法的 JSON')
  }
  if (parsed.error) throw new Error(`浏览器 worker 出错: ${parsed.error}`)

  return { mermaid: parsed.mermaid ?? [], images: parsed.images ?? [] }
}

export async function runBrowserPass(
  payload: BrowserPassPayload,
  options: BrowserPassOptions,
): Promise<BrowserPassResult> {
  const timeoutMs = options.timeoutMs ?? 60_000
  const workDir = await mkdtemp(join(tmpdir(), 'md-export-'))
  try {
    const workerJs = await bundleWorker()
    const payloadPath = join(workDir, 'payload.js')
    const workerPath = join(workDir, 'worker.js')
    const htmlPath = join(workDir, 'index.html')

    await writeFile(payloadPath, `window.__MDR_PAYLOAD__ = ${JSON.stringify(payload)};\n`)
    await writeFile(workerPath, workerJs)
    await writeFile(
      htmlPath,
      buildWorkerHtml({
        mermaidUrl: pathToFileURL(resolveMermaidScript()).href,
        payloadUrl: pathToFileURL(payloadPath).href,
        workerUrl: pathToFileURL(workerPath).href,
      }),
    )

    const dump = await dumpDom(options.browser, htmlPath, workDir, timeoutMs)
    return parseResult(dump)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
