import styleCss from './style.css?raw'
import { FONT_SIZE_MAP } from '@/shared/types'
import type { StorageData, LightTheme, DarkTheme, FontSize } from '@/shared/types'

const KATEX_VERSION = '0.16.45'

export type ExportTheme =
  | 'light' | 'dark' | 'nordic' | 'claude' | 'catppuccin' | 'tokyo-night' | 'github-dark' | 'everforest'
  | 'catppuccin-latte' | 'github-light' | 'rose-pine-dawn' | 'everforest-light'

function themeFromLight(theme: LightTheme): ExportTheme {
  return theme === 'default' ? 'light' : theme
}

function themeFromDark(theme: DarkTheme): ExportTheme {
  return theme === 'default' ? 'dark' : theme
}

function resolveCurrentTheme(data: StorageData): ExportTheme {
  const mode = data.colorMode ?? 'light'
  const isDark = mode === 'auto'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : mode === 'dark'
  return isDark ? themeFromDark(data.darkTheme ?? 'default') : themeFromLight(data.lightTheme ?? 'default')
}

function extractThemeVariables(css: string): string {
  const start = css.indexOf(':root {')
  const end = css.indexOf('\n\nbody.md-reader {')
  if (start === -1 || end === -1) return ''
  return css.slice(start, end).trim()
}

function extractExportSections(css: string): string {
  const startMarker = '/* @mdr-export:start */'
  const endMarker = '/* @mdr-export:end */'
  const sections: string[] = []
  let searchFrom = 0

  while (searchFrom < css.length) {
    const start = css.indexOf(startMarker, searchFrom)
    if (start === -1) break
    const end = css.indexOf(endMarker, start + startMarker.length)
    if (end === -1) break
    sections.push(css.slice(start + startMarker.length, end).trim())
    searchFrom = end + endMarker.length
  }

  return sections.join('\n\n')
}

function transformContentCss(css: string): string {
  return css.replace(/\.md-reader__markdown-content/g, '.md-content')
}

function buildLayoutCss(fontSize: number): string {
  return `
html {
  color-scheme: light dark;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--mdr-bg);
  color: var(--mdr-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  line-height: 1.6;
  counter-reset: katexEqnNo mmlEqnNo;
}

.md-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 48px 48px;
  color: var(--mdr-text);
  font-size: ${fontSize}px;
  word-break: break-word;
  overflow-x: hidden;
}

.md-content img {
  cursor: default;
}

#mdr-theme-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--mdr-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--mdr-bg) 88%, transparent);
  color: var(--mdr-text-secondary);
  box-shadow: 0 8px 24px var(--mdr-elevated-shadow-soft);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

#mdr-theme-toggle:hover {
  color: var(--mdr-link);
  background: var(--mdr-hover-bg-strong);
}

#mdr-theme-toggle:active {
  transform: scale(0.96);
}

#mdr-theme-toggle svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

@media (max-width: 640px) {
  .md-content {
    padding: 20px 16px 36px;
  }

  #mdr-theme-toggle {
    right: 12px;
    bottom: 12px;
    width: 40px;
    height: 40px;
  }
}

@media (min-width: 1660px) {
  .md-content {
    max-width: 1120px;
  }
}

@media (min-width: 2048px) {
  .md-content {
    max-width: 1280px;
  }
}

@media print {
  #mdr-theme-toggle {
    display: none !important;
  }

  html,
  body,
  .md-content {
    background: #fff !important;
    color: #1a1a1a !important;
  }

  .md-content,
  .md-content p:not(.markdown-alert-title),
  .md-content li,
  .md-content td,
  .md-content th {
    color: #1a1a1a !important;
  }

  .md-content h1,
  .md-content h2,
  .md-content h3,
  .md-content h4,
  .md-content h5,
  .md-content h6 {
    color: #111 !important;
  }

  .md-content blockquote:not(.info):not(.tip):not(.tips):not(.success):not(.warning):not(.danger),
  .md-content blockquote:not(.info):not(.tip):not(.tips):not(.success):not(.warning):not(.danger) p {
    color: #333 !important;
    border-left-color: #666 !important;
    background: transparent !important;
  }

  .md-content a {
    color: #1a1a1a !important;
    text-decoration: underline;
  }

  .md-content pre,
  .md-content pre code,
  .md-content code {
    background: #f5f5f5 !important;
    color: #1a1a1a !important;
  }

  .md-content hr {
    border-top-color: #ccc !important;
  }

  .md-content img,
  .md-content .mermaid svg {
    max-width: 100% !important;
    break-inside: avoid;
  }
}
`.trim()
}

let cachedExportCss: string | null = null

function getExportCss(fontSize: number): string {
  const layout = buildLayoutCss(fontSize)
  if (cachedExportCss) return `${cachedExportCss}\n${layout}`
  const themeCss = extractThemeVariables(styleCss)
  const contentCss = transformContentCss(extractExportSections(styleCss))
  cachedExportCss = `${themeCss}\n${contentCss}`
  return `${cachedExportCss}\n${layout}`
}

function cleanContent(root: HTMLElement): void {
  root.className = 'md-content'
  root.removeAttribute('hidden')
  root.querySelectorAll('.md-reader__btn--copy').forEach((el) => el.remove())
  root.querySelectorAll('.md-reader__head-anchor').forEach((el) => el.remove())
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/\.(md|mdx|mdc|mkd|markdown|txt)$/i, '')
  const safe = base.replace(/[^\w\u4e00-\u9fff.-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'document'
}

const SUN_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
const MOON_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`

function buildHtmlDocument(options: {
  bodyHtml: string
  title: string
  lightTheme: ExportTheme
  darkTheme: ExportTheme
  initialTheme: ExportTheme
  css: string
}): string {
  const { bodyHtml, title, lightTheme, darkTheme, initialTheme, css } = options
  const safeTitle = escapeHtml(title)

  return `<!DOCTYPE html>
<html lang="zh-CN" data-mdr-theme="${initialTheme}" data-mdr-light="${lightTheme}" data-mdr-dark="${darkTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" crossorigin="anonymous">
  <style>${css}</style>
</head>
<body>
  <article class="md-content">${bodyHtml}</article>
  <button id="mdr-theme-toggle" type="button" aria-label="切换主题">${MOON_ICON}</button>
  <script>
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('mdr-theme-toggle');
  var light = root.dataset.mdrLight;
  var dark = root.dataset.mdrDark;
  var sun = ${JSON.stringify(SUN_ICON)};
  var moon = ${JSON.stringify(MOON_ICON)};

  function syncIcon() {
    var current = root.getAttribute('data-mdr-theme');
    btn.innerHTML = current === dark ? sun : moon;
    btn.setAttribute('aria-label', current === dark ? '切换到浅色' : '切换到深色');
  }

  btn.addEventListener('click', function () {
    var current = root.getAttribute('data-mdr-theme');
    root.setAttribute('data-mdr-theme', current === dark ? light : dark);
    syncIcon();
  });

  syncIcon();
})();
  </script>
</body>
</html>`
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

export function exportMarkdownHtml(options: {
  content: HTMLElement
  data: StorageData
  filename: string
}): void {
  const lightTheme = themeFromLight(options.data.lightTheme ?? 'default')
  const darkTheme = themeFromDark(options.data.darkTheme ?? 'default')
  const initialTheme = resolveCurrentTheme(options.data)
  const fontSize = FONT_SIZE_MAP[(options.data.fontSize ?? 'Medium') as FontSize]

  const clone = options.content.cloneNode(true) as HTMLElement
  cleanContent(clone)

  const title = sanitizeFilename(options.filename)
  const html = buildHtmlDocument({
    bodyHtml: clone.innerHTML,
    title,
    lightTheme,
    darkTheme,
    initialTheme,
    css: getExportCss(fontSize),
  })

  downloadBlob(`${title}.html`, html)
}
