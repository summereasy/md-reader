// 运行在扩展 origin 的隐藏 iframe 里, 替内容脚本读取 file:// 资源。
//
// 为什么需要它:// 1. 内容脚本注入在 file:// 页面里, 属于页面上下文, 没有读取本地文件的权限, fetch 会被拒;
// 2. MV3 Service Worker 每次冷启动时, "允许访问文件网址" 权限位是异步下发的, 首个 file://
//    请求赶在权限位落地前会被 Chrome 拒绝并打出 "Not allowed to load local resource",
//    只能靠 300ms 后重试恢复 —— 功能正常但浏览器日志里会累计错误;
// 3. 扩展页面上下文 (chrome-extension:// origin) 读取 file:// 稳定可用 (实测目录列表 1ms
//    返回, 无任何错误日志), 所以把读取工作放到这个 iframe 里完成。
//
// 协议: 内容脚本 postMessage 请求 { channel, type: 'request', id, url, mode },
//        本文件 postMessage 回应 { channel, type: 'response', id, ok, value | error }.
//        加载完成后先发一条 { channel, type: 'ready' } 通知对端。

const CHANNEL = 'md-reader:local-file'

type RequestMode = 'text' | 'dataUrl'

interface FrameRequest {
  channel: string
  type: 'request'
  id: number
  url: string
  mode: RequestMode
}

interface FrameResponse {
  channel: string
  type: 'response'
  id: number
  ok: boolean
  value?: string
  error?: string
}

function reply(message: FrameResponse): void {
  window.parent.postMessage(message, '*')
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  return await res.text()
}

async function fetchDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

async function handleRequest(request: FrameRequest): Promise<void> {
  try {
    const value = request.mode === 'dataUrl' ? await fetchDataUrl(request.url) : await fetchText(request.url)
    reply({ channel: CHANNEL, type: 'response', id: request.id, ok: true, value })
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    reply({ channel: CHANNEL, type: 'response', id: request.id, ok: false, error: message })
  }
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== window.parent) return
  const data = event.data as Partial<FrameRequest> | null
  if (!data || data.channel !== CHANNEL || data.type !== 'request') return
  if (typeof data.id !== 'number' || typeof data.url !== 'string') return
  if (data.mode !== 'text' && data.mode !== 'dataUrl') return
  void handleRequest({ channel: CHANNEL, type: 'request', id: data.id, url: data.url, mode: data.mode })
})

// 通知内容脚本可以发请求了
window.parent.postMessage({ channel: CHANNEL, type: 'ready' }, '*')

// 该文件作为独立模块编译, 避免声明泄漏到全局作用域
export {}
