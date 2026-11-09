import styleCss from './style.css?raw'
import { FONT_SIZE_MAP } from '@/shared/types'
import type { StorageData, FontSize } from '@/shared/types'
import {
  buildHtmlDocument,
  getExportCss,
  sanitizeFilename,
  themeFromDark,
  themeFromLight,
} from '@/shared/export-template'
import type { ExportTheme } from '@/shared/export-template'
import { optimizeImageDataUrl } from '@/shared/export-image'

function resolveCurrentTheme(data: StorageData): ExportTheme {
  const mode = data.colorMode ?? 'light'
  const isDark = mode === 'auto'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : mode === 'dark'
  return isDark ? themeFromDark(data.darkTheme ?? 'default') : themeFromLight(data.lightTheme ?? 'default')
}

function cleanContent(root: HTMLElement): void {
  root.className = 'md-content'
  root.removeAttribute('hidden')
  root.querySelectorAll('.md-reader__btn--copy').forEach((el) => el.remove())
  root.querySelectorAll('.md-reader__head-anchor').forEach((el) => el.remove())
}

function downloadBlob(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function fetchImageDataUrl(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { action: 'fetchDataUrl', data: { url } },
        (res: unknown) => {
          if (chrome.runtime.lastError || typeof res !== 'string' || !res.startsWith('data:')) {
            resolve(undefined)
          } else {
            resolve(res)
          }
        },
      )
    } catch {
      resolve(undefined)
    }
  })
}

/**
 * 将 file: 协议的本地图片内联为 base64 data URI，
 * 否则导出的 HTML 换个目录后相对路径全部失效。
 * 读取失败时保留原 src，远程 (http/https) 图片保持原样。
 */
async function inlineLocalImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'))
  const cache = new Map<string, string | undefined>()

  await Promise.all(
    imgs.map(async (img) => {
      const raw = img.getAttribute('src')
      if (!raw) return

      let abs: string
      try {
        abs = new URL(raw, location.href).href
      } catch {
        return
      }
      if (!abs.startsWith('file:')) return

      if (!cache.has(abs)) {
        const dataUrl = await fetchImageDataUrl(abs)
        cache.set(abs, dataUrl ? await optimizeImageDataUrl(dataUrl) : undefined)
      }
      const dataUrl = cache.get(abs)
      if (dataUrl) img.setAttribute('src', dataUrl)
    }),
  )
}

export async function exportMarkdownHtml(options: {
  content: HTMLElement
  data: StorageData
  filename: string
}): Promise<void> {
  const lightTheme = themeFromLight(options.data.lightTheme ?? 'default')
  const darkTheme = themeFromDark(options.data.darkTheme ?? 'default')
  const initialTheme = resolveCurrentTheme(options.data)
  const fontSize = FONT_SIZE_MAP[(options.data.fontSize ?? 'Medium') as FontSize]

  const clone = options.content.cloneNode(true) as HTMLElement
  cleanContent(clone)
  await inlineLocalImages(clone)

  const title = sanitizeFilename(options.filename)
  const html = buildHtmlDocument({
    bodyHtml: clone.innerHTML,
    title,
    lightTheme,
    darkTheme,
    initialTheme,
    css: getExportCss(styleCss, fontSize),
  })

  downloadBlob(`${title}.html`, html)
}
