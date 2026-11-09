/**
 * 导出 HTML 时对本地图片做的浏览器端处理 (缩放 + 重编码).
 *
 * 这段代码同时被扩展 (content script 里直接执行) 和 CLI 的 headless
 * 浏览器 worker (cli/browser-worker.ts) 复用, 所以保持 DOM-only, 不碰 chrome.* API.
 *
 * 内嵌图片前先压缩: 导出的 HTML 里常有很多本地截图, 原图 (例如 3816px 宽的
 * PPT 截图) 直接 base64 会让单文件膨胀到几十 MB. 这里把图片缩到宽度最多
 * 720px (长截图另加最长边 2400px 兜底) 并重新编码为 JPEG, 正文显示宽度
 * 只有 980px 左右, 视觉损失可以忽略, 体积通常能降到原来的 1/5 以下.
 * 小于 200KB 且无需缩放的图直接保留原样.
 */
export const EXPORT_IMAGE_MAX_WIDTH = 720
export const EXPORT_IMAGE_MAX_SIDE = 2400
export const EXPORT_IMAGE_QUALITY = 0.82
export const EXPORT_IMAGE_MIN_BYTES = 200 * 1024

export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = dataUrl
  })
}

export async function optimizeImageDataUrl(dataUrl: string): Promise<string> {
  if (!/^data:image\/(jpeg|jpg|png|webp|bmp)/i.test(dataUrl)) return dataUrl

  const originalBytes = dataUrlByteLength(dataUrl)
  const image = await loadDataUrlImage(dataUrl)
  if (!image) return dataUrl

  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!width || !height) return dataUrl

  const scale = Math.min(
    1,
    EXPORT_IMAGE_MAX_WIDTH / width,
    EXPORT_IMAGE_MAX_SIDE / Math.max(width, height),
  )
  if (scale >= 1 && originalBytes < EXPORT_IMAGE_MIN_BYTES) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  // 统一铺白底, 避免 PNG 透明区域转 JPEG 后发黑
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  for (const quality of [EXPORT_IMAGE_QUALITY, 0.72]) {
    const optimized = canvas.toDataURL('image/jpeg', quality)
    if (dataUrlByteLength(optimized) < originalBytes) return optimized
  }
  return dataUrl
}
