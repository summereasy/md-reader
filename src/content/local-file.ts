// 本地文件读取通道 (内容脚本侧)。
//
// 内容脚本本身没有 file:// 读取权限; MV3 Service Worker 冷启动时首次 file:// 请求也会被
// Chrome 拒绝 (Not allowed to load local resource), 只能靠重试恢复。这里用一个扩展 origin
// 的隐藏 iframe (file-fetch-frame.html) 代劳, 失败时回退到 background 的原有逻辑。

const CHANNEL = 'md-reader:local-file'
const FRAME_FILE = 'file-fetch-frame.html'
const FRAME_TIMEOUT_MS = 10_000

type RequestMode = 'text' | 'dataUrl'

interface FrameResponse {
  channel: string
  type: 'response' | 'ready'
  id?: number
  ok?: boolean
  value?: string
  error?: string
}

interface Waiter {
  resolve: (value: string) => void
  reject: (error: Error) => void
  timer: number
}

let frame: HTMLIFrameElement | null = null
let frameReady: Promise<void> | null = null
let readyResolver: (() => void) | null = null
let requestSeq = 0
const waiters = new Map<number, Waiter>()
let listening = false

function ensureListener(): void {
  if (listening) return
  listening = true
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!frame || event.source !== frame.contentWindow) return
    const data = event.data as FrameResponse | null
    if (!data || data.channel !== CHANNEL) return
    if (data.type === 'ready') {
      readyResolver?.()
      return
    }
    if (data.type !== 'response' || typeof data.id !== 'number') return
    const waiter = waiters.get(data.id)
    if (!waiter) return
    waiters.delete(data.id)
    window.clearTimeout(waiter.timer)
    if (data.ok && typeof data.value === 'string') waiter.resolve(data.value)
    else waiter.reject(new Error(data.error ?? 'local file read failed'))
  })
}

function ensureFrame(): Promise<void> {
  if (frameReady) return frameReady
  ensureListener()
  frameReady = new Promise<void>((resolve) => {
    readyResolver = resolve
    const iframe = document.createElement('iframe')
    iframe.src = chrome.runtime.getURL(FRAME_FILE)
    iframe.hidden = true
    iframe.setAttribute('aria-hidden', 'true')
    ;(document.body ?? document.documentElement).appendChild(iframe)
    frame = iframe
  })
  return frameReady
}

export function isLocalFileUrl(url: string): boolean {
  return url.startsWith('file:')
}

function readInFrame(url: string, mode: RequestMode): Promise<string> {
  return ensureFrame().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const id = ++requestSeq
        const timer = window.setTimeout(() => {
          waiters.delete(id)
          reject(new Error('local file bridge timeout'))
        }, FRAME_TIMEOUT_MS)
        waiters.set(id, { resolve, reject, timer })
        frame?.contentWindow?.postMessage({ channel: CHANNEL, type: 'request', id, url, mode }, '*')
      }),
  )
}

function sendToBackground(action: string, url: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, data: { url } }, (res: string | undefined) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else resolve(res)
    })
  })
}

// file:// 优先在扩展 iframe 上下文里读, 失败再回退到 background (可能留下一条
// Not allowed 日志, 但保证功能可用)
async function readLocal(url: string, mode: RequestMode, fallbackAction: string): Promise<string | undefined> {
  if (isLocalFileUrl(url)) {
    try {
      return await readInFrame(url, mode)
    } catch {
      // 回退到 background
    }
  }
  try {
    return await sendToBackground(fallbackAction, url)
  } catch {
    return undefined
  }
}

/** 读取文本: file:// 走扩展 iframe, 其他协议仍走 background */
export function readLocalText(url: string, fallbackAction: 'fetch' | 'readFile'): Promise<string | undefined> {
  return readLocal(url, 'text', fallbackAction)
}

/** 读取二进制并转 data URI (本地图片内联导出用) */
export function readLocalDataUrl(url: string): Promise<string | undefined> {
  return readLocal(url, 'dataUrl', 'fetchDataUrl')
}

/** 读取 file:// 目录列表 HTML */
export function readLocalDirectoryHtml(url: string): Promise<string | undefined> {
  return readLocal(url, 'text', 'directory')
}
