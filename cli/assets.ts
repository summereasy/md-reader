/**
 * 把 Markdown 里引用的本地图片内联成 base64 data URI.
 *
 * 和扩展里 inlineLocalImages 的目的一样: 导出的 HTML 是一个独立文件,
 * 换个目录 (或者上传到静态服务器) 后相对路径就全失效了, 只有内联才稳.
 * 远程 http(s) 图片保持原样 (和扩展行为一致), 读不到的文件保留原 src.
 */
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
}

export interface LocalImageAsset {
  id: string
  dataUrl: string
}

export interface CollectLocalImagesResult {
  html: string
  images: LocalImageAsset[]
  /** 图片 id → HTML 里的占位 token, 等浏览器 pass 压缩完再写回 */
  tokens: { id: string; token: string }[]
  warnings: string[]
}

/** 把 src 解析成本地文件路径; 远程 / data: / 解析失败返回 null. */
function resolveLocalPath(rawSrc: string, baseDir: string): string | null {
  const value = rawSrc.trim()
  if (!value) return null
  if (/^file:/i.test(value)) {
    try {
      return fileURLToPath(value)
    } catch {
      return null
    }
  }
  // 其他带协议的 (http:, https:, data:, blob:, //cdn...) 一律不动
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null

  const withoutFragment = value.split('#')[0]!.split('?')[0]!
  let decoded = withoutFragment
  try {
    decoded = decodeURIComponent(withoutFragment)
  } catch {
    // 保持原样
  }
  return resolve(baseDir, decoded)
}

export async function collectLocalImages(
  html: string,
  baseDir: string,
): Promise<CollectLocalImagesResult> {
  const warnings: string[] = []
  const images: LocalImageAsset[] = []
  const tokens: { id: string; token: string }[] = []
  const idByPath = new Map<string, string>()
  const edits: { start: number; end: number; token: string }[] = []

  const tagRe = /<img\b[^>]*>/gi
  for (const match of html.matchAll(tagRe)) {
    const tag = match[0]
    const tagStart = match.index ?? 0
    const attr = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag)
    if (!attr) continue

    const rawSrc = attr[2] ?? ''
    const absPath = resolveLocalPath(rawSrc, baseDir)
    if (!absPath) continue

    let id = idByPath.get(absPath)
    if (id === undefined) {
      try {
        const bytes = await readFile(absPath)
        const mime = MIME_BY_EXT[extname(absPath).toLowerCase()] ?? 'application/octet-stream'
        id = String(images.length)
        images.push({ id, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` })
        idByPath.set(absPath, id)
      } catch (error) {
        warnings.push(`无法读取图片 ${absPath}: ${(error as Error).message}`)
        continue
      }
    }

    const token = `__MDR_LOCAL_IMG_${id}__`
    if (!tokens.some((entry) => entry.id === id)) tokens.push({ id, token })

    // src="..." 里值的起始位置
    const valueStart = tagStart + attr.index + attr[0].length - rawSrc.length - 1
    edits.push({ start: valueStart, end: valueStart + rawSrc.length, token })
  }

  let out = ''
  let cursor = 0
  for (const edit of edits) {
    out += html.slice(cursor, edit.start) + edit.token
    cursor = edit.end
  }
  out += html.slice(cursor)

  return { html: out, images, tokens, warnings }
}

/** 把占位 token 换回最终的 data URI (可能是压缩后的). */
export function applyImageDataUrls(
  html: string,
  tokens: { id: string; token: string }[],
  images: { id: string; dataUrl: string }[],
): string {
  const byId = new Map(images.map((image) => [image.id, image.dataUrl]))
  let out = html
  for (const entry of tokens) {
    const dataUrl = byId.get(entry.id)
    if (!dataUrl) continue
    out = out.split(entry.token).join(dataUrl)
  }
  return out
}
