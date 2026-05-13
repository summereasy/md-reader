import hljs from 'highlight.js'
import MarkdownIt from 'markdown-it'
import type { Options as MdOptions } from 'markdown-it'
import mSub from 'markdown-it-sub'
import mSup from 'markdown-it-sup'
import mIns from 'markdown-it-ins'
import mAbbr from 'markdown-it-abbr'
import mMark from 'markdown-it-mark'
import mEmoji from 'markdown-it-emoji'
import mDeflist from 'markdown-it-deflist'
import mFootnote from 'markdown-it-footnote'
import mTaskLists from 'markdown-it-task-lists'
import mToc from 'markdown-it-table-of-contents'
import mKatex from '@traptitech/markdown-it-katex'
import mMermaid from '@md-reader/markdown-it-mermaid'
import mAlert from './plugins/alert'
import mMultimdTable from 'markdown-it-multimd-table'
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
import type { MdPlugin, Theme } from '@/shared/types'
import { MD_PLUGINS } from '@/shared/types'

// Copy button SVG icons
const copySvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`
const successSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`

const copyBtnHtml = `<button class="md-reader__btn md-reader__btn--copy" title="Copy"><span class="md-reader__copy-icon">${copySvg}</span><span class="md-reader__copy-success">${successSvg}</span></button>`

function getThemeMd(theme: Theme): 'dark' | 'default' {
  return theme === 'dark' || theme === 'nordic' ? 'dark' : 'default'
}

type PluginFactory = (opts: { theme: Theme }) => [unknown, ...unknown[]]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLUGINS: Record<string, any[] | PluginFactory> = {
  Emoji: [mEmoji as any],
  Sub: [mSub],
  Sup: [mSup],
  Ins: [mIns],
  Abbr: [mAbbr],
  Katex: [mKatex, { strict: false, throwOnError: false }],
  Mermaid: ({ theme }) => [
    mMermaid,
    { theme: getThemeMd(theme), themeVariables: undefined },
  ],
  Mark: [mMark],
  Deflist: [mDeflist],
  Footnote: [mFootnote],
  TaskLists: [mTaskLists],
  TOC: [mToc],
  Alert: [mAlert],
}

export interface RenderOptions {
  config?: MdOptions
  plugins?: MdPlugin[]
  theme?: Theme
}

let mdInstance: MarkdownIt | null = null

function initMarkdownIt({ config = {}, plugins = [...MD_PLUGINS], theme = 'light' }: RenderOptions = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    breaks: false,
    linkify: true,
    xhtmlOut: true,
    typographer: true,
    highlight(str: string, language: string) {
      if (language && hljs.getLanguage(language)) {
        try {
          const highlighted = hljs.highlight(str, { language, ignoreIllegals: true }).value
          return `<pre class="hljs-pre"><code class="hljs" lang="${language}">${highlighted}</code>${copyBtnHtml}</pre>`
        } catch {
          // fall through
        }
      }
      const code = escapeHtml(str)
      return `<pre class="hljs-pre"><code class="hljs ${language || ''}">${code}</code>${copyBtnHtml}</pre>`
    },
    ...config,
  })

  // Parse email links
  md.linkify.set({ fuzzyEmail: true })
  // Builtin multimd table
  md.use(mMultimdTable)

  // Custom plugins
  for (const name of plugins) {
    let plugin = PLUGINS[name]
    if (!plugin) continue
    if (typeof plugin === 'function') {
      plugin = plugin({ theme })
    }
    // plugin is always [PluginWithOptions, ...opts] at this point
    const [p, ...opts] = plugin as [any, ...any[]]
    md.use(p, ...opts)
  }

  return md
}

// Remove YAML frontmatter
function removeFrontmatter(content: string): string {
  const fmRegex = /^---[\s\S]+?---\n/
  return content.replace(fmRegex, '')
}

interface MdRenderFn {
  (code: string, options?: RenderOptions): string
  _md?: MarkdownIt
}

export const mdRender: MdRenderFn = (code, options) => {
  if (!mdRender._md || options) {
    mdRender._md = initMarkdownIt(options)
  }
  const filtered = removeFrontmatter(code)
  return mdRender._md.render(filtered)
}
