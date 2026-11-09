/**
 * headless 浏览器 worker: 渲染 mermaid 图, 压缩要内联的图片.
 *
 * 由 cli/browser.ts 在运行时用 Bun.build 打包成 IIFE, 塞进一个临时 HTML 页面:
 * 页面先加载 mermaid.min.js, 再加载 payload.js (window.__MDR_PAYLOAD__),
 * 最后加载本文件. 结果以 base64 JSON 写进 <pre id="mdr-result">, 交给
 * 外层的 `--dump-dom` 读回来.
 *
 * 为什么不在 Bun 里直接渲染 mermaid? mermaid 9 依赖真实的 SVG/DOM 布局
 * (d3 + getBBox), 没有 DOM 就跑不起来; 用 headless Chrome 是最省事、
 * 又能和扩展里点 Export 时得到完全一样 SVG 的做法.
 */
import { optimizeImageDataUrl } from '../src/shared/export-image'

type MermaidTheme = 'default' | 'dark'

interface WorkerPayload {
  mermaid?: string[]
  mermaidTheme?: MermaidTheme
  images?: { id: string; dataUrl: string }[]
}

interface MermaidOutcome {
  svg?: string
  error?: string
}

interface ImageOutcome {
  id: string
  dataUrl: string
}

interface WorkerResult {
  mermaid: MermaidOutcome[]
  images: ImageOutcome[]
  error?: string
}

declare global {
  interface Window {
    __MDR_PAYLOAD__?: WorkerPayload
    mermaid?: any
  }
}

/** UTF-8 安全的 base64: dump-dom 拿到的文本里不能有裸换行/引号问题. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...Array.from(chunk))
  }
  return btoa(binary)
}

async function renderMermaid(mermaid: any, code: string, index: number): Promise<MermaidOutcome> {
  const id = `mdr-mermaid-${index}`
  try {
    let svg = ''
    const returned = mermaid.mermaidAPI.render(id, code, (rendered: string) => {
      svg = rendered
    })
    if (!svg && typeof returned === 'string') svg = returned
    if (!svg && typeof mermaid.mermaidAPI.renderAsync === 'function') {
      svg = await mermaid.mermaidAPI.renderAsync(id, code)
    }
    if (!svg) return { error: 'mermaid 渲染结果为空' }
    return { svg }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function main(): Promise<void> {
  const payload = window.__MDR_PAYLOAD__ ?? {}
  const result: WorkerResult = { mermaid: [], images: [] }

  try {
    const blocks = payload.mermaid ?? []
    if (blocks.length > 0) {
      const mermaid = window.mermaid
      if (!mermaid?.mermaidAPI) {
        result.mermaid = blocks.map(() => ({ error: 'mermaid 脚本未加载' }))
      } else {
        // 与扩展 renderer-entry.ts 的 renderMermaidDiagrams 保持一致
        mermaid.initialize({
          startOnLoad: false,
          theme: payload.mermaidTheme ?? 'default',
          themeVariables: undefined,
          securityLevel: 'strict',
        })
        for (let index = 0; index < blocks.length; index += 1) {
          result.mermaid.push(await renderMermaid(mermaid, blocks[index]!, index))
        }
      }
    }

    for (const image of payload.images ?? []) {
      let dataUrl = image.dataUrl
      try {
        dataUrl = await optimizeImageDataUrl(image.dataUrl)
      } catch {
        // 压缩失败就保留原图
      }
      result.images.push({ id: image.id, dataUrl })
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }

  const pre = document.createElement('pre')
  pre.id = 'mdr-result'
  pre.textContent = toBase64(JSON.stringify(result))
  document.body.appendChild(pre)
  document.documentElement.setAttribute('data-mdr-done', '1')
}

void main()
