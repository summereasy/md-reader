/**
 * CLI 侧的 Markdown → HTML 渲染.
 *
 * 直接复用扩展的 src/content/renderer.ts (它是 DOM-free 的 markdown-it 封装),
 * 所以 CLI 出来的正文和浏览器里点 Export 的正文是同一套规则.
 * 这里只补两件扩展在 DOM 里做的事:
 *   1. 给 heading 加 id (扩展在 buildTocTree 里做, 用于锚点跳转)
 *   2. 把 mermaid 占位符换成渲染好的 SVG (扩展在 renderMermaidDiagrams 里做)
 */
import { mdRender, mermaidBlocks } from '../src/content/renderer'
import { escapeHtml } from '../src/shared/export-template'
import { MD_PLUGINS } from '../src/shared/types'
import type { MdPlugin } from '../src/shared/types'

export type CliResolvedTheme =
  | 'light'
  | 'dark'
  | 'nordic'
  | 'claude'
  | 'catppuccin'
  | 'tokyo-night'
  | 'github-dark'
  | 'everforest'
  | 'catppuccin-latte'
  | 'github-light'
  | 'rose-pine-dawn'
  | 'everforest-light'

export interface RenderMarkdownOptions {
  theme?: CliResolvedTheme
  plugins?: MdPlugin[]
}

export interface RenderMarkdownResult {
  html: string
  /** 按出现顺序排列的 mermaid 源码, 与 HTML 里的 data-mermaid-idx 对应 */
  mermaid: string[]
}

export function renderMarkdown(
  source: string,
  options: RenderMarkdownOptions = {},
): RenderMarkdownResult {
  const html = mdRender(source, {
    theme: options.theme ?? 'light',
    plugins: options.plugins ?? [...MD_PLUGINS],
  })
  return { html, mermaid: [...mermaidBlocks] }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * 复刻 renderer-entry.ts 里 buildTocTree 的 id 规则:
 *   encodeURIComponent(text.toLowerCase().replace(/\s+/g, '-'))
 * 重名时依次追加 -1, -2 …
 */
export function addHeadingIds(html: string): string {
  const used = new Map<string, number>()
  return html.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (whole, level: string, attrs: string, inner: string) => {
      if (/\bid\s*=/i.test(attrs)) return whole
      const text = decodeEntities(inner.replace(/<[^>]*>/g, '')).trim()
      const base = encodeURIComponent(text.toLowerCase().replace(/\s+/g, '-')) || 'section'
      const seen = used.get(base) ?? 0
      used.set(base, seen + 1)
      const id = seen === 0 ? base : `${base}-${seen}`
      return `<h${level}${attrs} id="${id}">${inner}</h${level}>`
    },
  )
}

/**
 * 导出后的 HTML 是静态页面, 代码块的复制按钮没有意义.
 * 与扩展 export-html.ts 里 cleanContent 的行为保持一致.
 */
export function removeCopyButtons(html: string): string {
  return html.replace(/<button\b[^>]*md-reader__btn--copy[^>]*>[\s\S]*?<\/button>/g, '')
}

export interface MermaidOutcome {
  svg?: string
  error?: string
}

function mermaidCodeBlock(code: string): string {
  return `<pre class="hljs-pre"><code class="hljs language-mermaid">${escapeHtml(code)}</code></pre>`
}

/**
 * 替换 markdown-it 留下的 mermaid 占位符.
 * outcomes 为 null (没跑浏览器 / --no-mermaid) 时降级成普通代码块, 保证内容不丢.
 */
export function replaceMermaidPlaceholders(
  html: string,
  blocks: string[],
  outcomes: MermaidOutcome[] | null,
): string {
  return html.replace(
    /<div class="mermaid-placeholder" data-mermaid-idx="(\d+)"><\/div>/g,
    (_whole, rawIndex: string) => {
      const index = Number(rawIndex)
      const outcome = outcomes?.[index]
      if (outcome?.svg) return `<pre class="mermaid">${outcome.svg}</pre>`
      if (outcome?.error) return `<pre class="mermaid-error">${escapeHtml(outcome.error)}</pre>`
      return mermaidCodeBlock(blocks[index] ?? '')
    },
  )
}
