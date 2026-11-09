#!/usr/bin/env bun
/**
 * md-export — 把 Markdown 文件导出成与扩展 Export 按钮一致的独立 HTML.
 *
 * 用法见 --help. 整个流程:
 *   读取 .md → markdown-it 渲染 (复用扩展的 renderer) → 加 heading id →
 *   headless Chrome 渲染 mermaid / 压缩图片 → 套上扩展的导出模板 → 写文件.
 *
 * 之所以要起一个 headless 浏览器: mermaid 9 依赖真实 DOM 做布局, Bun 里跑不了;
 * 图片缩放/重编码也要 canvas. 两件事合并成一次浏览器 pass, 通常 1~3 秒.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { findBrowser, runBrowserPass } from './browser'
import type { MermaidOutcome } from './browser'
import { applyImageDataUrls, collectLocalImages } from './assets'
import type { LocalImageAsset } from './assets'
import { addHeadingIds, removeCopyButtons, renderMarkdown, replaceMermaidPlaceholders } from './render'
import {
  buildHtmlDocument,
  getExportCss,
  sanitizeFilename,
  themeFromDark,
  themeFromLight,
} from '../src/shared/export-template'
import type { ExportTheme } from '../src/shared/export-template'
import { DARK_THEMES, FONT_SIZE_MAP, LIGHT_THEMES, MD_PLUGINS } from '../src/shared/types'
import type { DarkTheme, FontSize, LightTheme } from '../src/shared/types'

interface CliOptions {
  input?: string
  output?: string
  stdout: boolean
  title?: string
  theme?: string
  lightTheme?: string
  darkTheme?: string
  fontSize: string
  mermaid: boolean
  images: boolean
  compress: boolean
  browser?: string
  noBrowser: boolean
  quiet: boolean
}

const LIGHT_NAMES = new Set<string>(LIGHT_THEMES.map((theme) => theme.value))
const DARK_NAMES = new Set<string>(DARK_THEMES.map((theme) => theme.value))

function fail(message: string): never {
  process.stderr.write(`md-export: ${message}\n`)
  process.stderr.write('运行 md-export --help 查看用法\n')
  process.exit(1)
}

function printHelp(): void {
  process.stdout.write(`md-export — 把 Markdown 导出成与扩展 Export 按钮一致的独立 HTML

用法:
  md-export <input.md> [选项]

输入输出:
  <input.md>            要导出的 Markdown 文件; 用 - 表示从 stdin 读取
  -o, --output <path>   输出路径 (默认: 与输入同目录的 <标题>.html)
      --stdout          把 HTML 写到 stdout (stdout 上不会有其他内容)

内容:
  --title <text>        页面标题 (默认取文件名)
  --theme <name>        初始主题: auto (默认, 跟随系统) / light / dark /
                        claude / nordic / catppuccin / tokyo-night / github-dark /
                        everforest / catppuccin-latte / github-light /
                        rose-pine-dawn / everforest-light
  --light-theme <name>  浅色主题 (默认 default)
  --dark-theme <name>   深色主题 (默认 default)
  --font-size <name>    字号: Extreme Small / Very Small / Small / Medium /
                        Large (默认) / Very Large / Extreme Large
  --no-mermaid          不渲染 mermaid 图 (输出普通代码块)
  --no-images           不内联本地图片 (保留原 src)
  --no-compress         内联图片但不缩放/重编码

浏览器:
  --browser <path>      指定 Chromium 系浏览器可执行文件
  --no-browser          不启动浏览器: mermaid 降级成代码块, 图片不压缩
                        (也可用环境变量 MDR_CHROME 指定浏览器)

其他:
  -q, --quiet           不打印摘要
  -h, --help            显示本帮助
  -V, --version         显示版本

说明:
  mermaid 图和图片压缩需要 headless Chrome/Chromium, 会自动探测本机已安装的
  浏览器. 找不到时仍然能导出, 只是 mermaid 会退化成代码块、图片保留原图.
`)
}

function parseArgs(argv: string[]): { options: CliOptions; help: boolean; version: boolean } {
  const options: CliOptions = {
    stdout: false,
    fontSize: 'Large',
    mermaid: true,
    images: true,
    compress: true,
    noBrowser: false,
    quiet: false,
  }
  let help = false
  let version = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    let name = arg
    let inlineValue: string | undefined
    if (arg.startsWith('--') && arg.includes('=')) {
      const equals = arg.indexOf('=')
      name = arg.slice(0, equals)
      inlineValue = arg.slice(equals + 1)
    }

    const takeValue = (): string => {
      if (inlineValue !== undefined) return inlineValue
      const next = argv[index + 1]
      if (next === undefined) fail(`${name} 需要一个值`)
      index += 1
      return next
    }

    switch (name) {
      case '-h':
      case '--help':
        help = true
        break
      case '-V':
      case '--version':
        version = true
        break
      case '-q':
      case '--quiet':
        options.quiet = true
        break
      case '--stdout':
        options.stdout = true
        break
      case '-o':
      case '--output':
        options.output = takeValue()
        break
      case '--title':
        options.title = takeValue()
        break
      case '--theme':
        options.theme = takeValue()
        break
      case '--light-theme':
        options.lightTheme = takeValue()
        break
      case '--dark-theme':
        options.darkTheme = takeValue()
        break
      case '--font-size':
        options.fontSize = takeValue()
        break
      case '--browser':
        options.browser = takeValue()
        break
      case '--no-browser':
        options.noBrowser = true
        break
      case '--no-mermaid':
        options.mermaid = false
        break
      case '--no-images':
        options.images = false
        break
      case '--no-compress':
        options.compress = false
        break
      default:
        // 单独一个 "-" 是 stdin 的约定写法, 不是选项
        if (name.startsWith('-') && name !== '-') fail(`未知选项 ${arg}`)
        if (options.input !== undefined) fail(`只能指定一个输入文件 (多余: ${arg})`)
        options.input = arg
        break
    }
  }

  return { options, help, version }
}

function systemPrefersDark(): boolean {
  if (process.platform !== 'darwin') return false
  try {
    const result = spawnSync('defaults', ['read', '-g', 'AppleInterfaceStyle'], { encoding: 'utf8' })
    return result.status === 0 && result.stdout.trim().toLowerCase() === 'dark'
  } catch {
    return false
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function readVersion(): Promise<string> {
  try {
    const raw = await readFile(join(import.meta.dir, '..', 'package.json'), 'utf8')
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function resolveThemes(options: CliOptions): {
  lightTheme: ExportTheme
  darkTheme: ExportTheme
  initialTheme: ExportTheme
} {
  if (options.lightTheme && !LIGHT_NAMES.has(options.lightTheme)) {
    fail(`未知的浅色主题 ${options.lightTheme}`)
  }
  if (options.darkTheme && !DARK_NAMES.has(options.darkTheme)) {
    fail(`未知的深色主题 ${options.darkTheme}`)
  }

  let lightTheme = themeFromLight((options.lightTheme ?? 'default') as LightTheme)
  let darkTheme = themeFromDark((options.darkTheme ?? 'default') as DarkTheme)

  const requested = options.theme
  if (!requested || requested === 'auto') {
    return {
      lightTheme,
      darkTheme,
      initialTheme: systemPrefersDark() ? darkTheme : lightTheme,
    }
  }

  if (requested === 'light') return { lightTheme, darkTheme, initialTheme: lightTheme }
  if (requested === 'dark') return { lightTheme, darkTheme, initialTheme: darkTheme }

  if (requested !== 'default' && LIGHT_NAMES.has(requested)) {
    lightTheme = themeFromLight(requested as LightTheme)
    return { lightTheme, darkTheme, initialTheme: lightTheme }
  }
  if (requested !== 'default' && DARK_NAMES.has(requested)) {
    darkTheme = themeFromDark(requested as DarkTheme)
    return { lightTheme, darkTheme, initialTheme: darkTheme }
  }
  fail(`未知主题 ${requested} (可用 --theme auto|light|dark|<主题名>)`)
}

async function main(): Promise<void> {
  const startedAt = performance.now()
  const { options, help, version } = parseArgs(process.argv.slice(2))

  if (help) {
    printHelp()
    return
  }
  if (version) {
    process.stdout.write(`md-export ${await readVersion()}\n`)
    return
  }
  if (!options.input) fail('缺少输入文件 (或 --help 查看用法)')

  const fromStdin = options.input === '-'
  if (fromStdin && !options.stdout && !options.output) {
    fail('从 stdin 读取时必须指定 -o <path> 或 --stdout')
  }

  const fontSize = options.fontSize as FontSize
  const fontSizePx = FONT_SIZE_MAP[fontSize]
  if (fontSizePx === undefined) fail(`未知字号 ${options.fontSize}`)

  const inputPath = fromStdin ? null : resolve(options.input)
  if (inputPath && !existsSync(inputPath)) fail(`找不到输入文件 ${inputPath}`)

  const source = fromStdin ? await Bun.stdin.text() : await readFile(inputPath!, 'utf8')
  const baseDir = inputPath ? dirname(inputPath) : process.cwd()

  const { lightTheme, darkTheme, initialTheme } = resolveThemes(options)
  // 与扩展 renderMermaidDiagrams 一致: 只有 dark / nordic 用 mermaid 的 dark 主题
  const mermaidTheme: 'default' | 'dark' =
    initialTheme === 'dark' || initialTheme === 'nordic' ? 'dark' : 'default'

  const plugins = [...MD_PLUGINS].filter((plugin) => !(options.mermaid === false && plugin === 'Mermaid'))
  const rendered = renderMarkdown(source, { theme: initialTheme, plugins })
  let bodyHtml = removeCopyButtons(addHeadingIds(rendered.html))

  const collected = options.images
    ? await collectLocalImages(bodyHtml, baseDir)
    : { html: bodyHtml, images: [] as LocalImageAsset[], tokens: [], warnings: [] as string[] }
  bodyHtml = collected.html
  for (const warning of collected.warnings) process.stderr.write(`md-export: 警告: ${warning}\n`)

  const needsBrowser =
    rendered.mermaid.length > 0 || (options.compress && collected.images.length > 0)
  let browserPath: string | null = null
  if (!options.noBrowser && needsBrowser) {
    browserPath = findBrowser(options.browser)
    if (!browserPath) {
      process.stderr.write(
        'md-export: 警告: 没找到 Chromium 系浏览器, mermaid 会降级成代码块, 图片不做压缩\n' +
          '          (可用 --browser <path> 或环境变量 MDR_CHROME 指定)\n',
      )
    }
  }

  let mermaidOutcomes: MermaidOutcome[] | null = null
  let imageResults: { id: string; dataUrl: string }[] = collected.images

  if (browserPath && needsBrowser) {
    try {
      const result = await runBrowserPass(
        {
          mermaid: rendered.mermaid,
          mermaidTheme,
          images: options.compress ? collected.images : [],
        },
        { browser: browserPath },
      )
      mermaidOutcomes = result.mermaid
      if (options.compress && collected.images.length > 0 && result.images.length > 0) {
        const optimized = new Map(result.images.map((image) => [image.id, image.dataUrl]))
        imageResults = collected.images.map((image) => ({
          id: image.id,
          dataUrl: optimized.get(image.id) ?? image.dataUrl,
        }))
      }
    } catch (error) {
      process.stderr.write(`md-export: 警告: 浏览器渲染失败: ${(error as Error).message}\n`)
      process.stderr.write('          mermaid 降级成代码块, 图片不做压缩\n')
    }
  }

  bodyHtml = replaceMermaidPlaceholders(bodyHtml, rendered.mermaid, mermaidOutcomes)
  bodyHtml = applyImageDataUrls(bodyHtml, collected.tokens, imageResults)

  const styleCss = await readFile(join(import.meta.dir, '..', 'src', 'content', 'style.css'), 'utf8')
  const css = getExportCss(styleCss, fontSizePx)

  const fallbackName = inputPath ? basename(inputPath) : 'document.md'
  const title = sanitizeFilename(options.title ?? fallbackName)
  const html = buildHtmlDocument({ bodyHtml, title, lightTheme, darkTheme, initialTheme, css })

  const elapsed = performance.now() - startedAt
  const mermaidRendered = (mermaidOutcomes ?? []).filter((outcome) => outcome.svg).length
  const mermaidFailed = (mermaidOutcomes ?? []).filter((outcome) => outcome.error).length

  if (options.stdout) {
    process.stdout.write(html)
  } else {
    const outputPath = options.output
      ? resolve(options.output)
      : join(inputPath ? dirname(inputPath) : process.cwd(), `${title}.html`)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)

    if (!options.quiet) {
      const details = [
        `正文 ${formatBytes(Buffer.byteLength(bodyHtml, 'utf8'))}`,
        rendered.mermaid.length > 0 ? `mermaid ${mermaidRendered}/${rendered.mermaid.length}` : null,
        collected.images.length > 0 ? `内联图片 ${collected.images.length} 张` : null,
      ].filter(Boolean)
      process.stderr.write(
        `✓ 已导出 ${outputPath}\n` +
          `  ${formatBytes(Buffer.byteLength(html, 'utf8'))} · ${details.join(' · ')} · ${(elapsed / 1000).toFixed(1)}s\n`,
      )
    }
  }

  if (mermaidFailed > 0) {
    process.stderr.write(`md-export: 警告: ${mermaidFailed} 个 mermaid 图渲染失败, 已输出错误信息\n`)
  }
}

await main()
