// Heavy renderer entry — loaded dynamically by the thin content script
import throttle from 'lodash.throttle'
import { storage } from '@/shared/storage'
import { mdRender, mermaidBlocks } from './renderer'
import { FONT_SIZE_MAP, LIGHT_THEMES, DARK_THEMES, getDefaultData } from '@/shared/types'
import type { FontSize, StorageData, ColorMode, LightTheme, DarkTheme, ContentWidthMode } from '@/shared/types'
import { getEventBus } from './plugins/event'
import blockCopyPlugin from './plugins/block-copy'
import imgViewerPlugin from './plugins/img-viewer'
import {
  getFileName,
  getParentDirectoryURL,
  isFileInDirectory,
  normalizeFileURL,
  parseDirectoryListing,
  type FileTreeEntry,
} from './file-tree'
import katexCss from 'katex/dist/katex.min.css?raw'
import './style.css'

const PREFIX = 'md-reader__'

// DOM refs
const HTML = document.documentElement
const HEAD = document.head
const BODY = document.body

const HEADERS = 'h1, h2, h3, h4, h5, h6'
const ROOT_THEME_ATTR = 'data-mdr-theme'
const SIDE_WIDTH_VAR = '--mdr-side-width'
const CONTENT_FONT_SIZE_VAR = '--mdr-content-font-size'
const SIDE_WIDTH_STORAGE_KEY = 'sideWidth'
const LEGACY_DEFAULT_SIDE_WIDTH = 260
const PREVIOUS_DEFAULT_SIDE_WIDTH = 300
const PREVIOUS_DEFAULT_SIDE_WIDTH_MAX = 308
const FILE_TREE_ROOT_STORAGE_KEY = 'fileTreeRootURL'
const CURRENT_FILE_QUERY_KEY = 'mdReaderFile'
const KATEX_STYLE_ID = 'md-reader-katex-style'
const darkMQL = window.matchMedia('(prefers-color-scheme: dark)')
type ResolvedTheme = 'light' | 'dark' | 'nordic' | 'claude' | 'catppuccin' | 'tokyo-night' | 'github-dark' | 'everforest' | 'catppuccin-latte' | 'github-light' | 'rose-pine-dawn' | 'everforest-light'

interface TocItem {
  head: HTMLElement
  text: string
  encoded: string
  level: number
  li: HTMLElement
  children: TocItem[]
}

const CN = {
  BODY: `${PREFIX}body`,
  SIDE: `${PREFIX}side`,
  SIDE_ACTIVE: `${PREFIX}side-li--active`,
  CONTENT: `${PREFIX}markdown-content`,
  BTN_WRAP: `${PREFIX}button-wrap`,
  BTN: `${PREFIX}btn`,
  BTN_CODE_TOGGLE: `${PREFIX}btn--code-toggle`,
  BTN_SIDE_EXPAND: `${PREFIX}btn--side-expand`,
  BTN_GO_TOP: `${PREFIX}btn--go-top`,
  SIDE_COLLAPSED: 'side-collapsed',
  SIDE_EXPANDED: 'side-expanded',
  HEAD_ANCHOR: `${PREFIX}head-anchor`,
  CENTERED: 'centered',
  RAW_CONTENT: `${PREFIX}raw-content`,
}

// --- Lucide icons ----------------------------------------------------------
import { createElement as lucideIcon } from 'lucide'
import {
  Code2, PanelLeft, ArrowUp, Sun, Moon, Monitor,
  AlignCenter, AlignLeft, Settings, Search,
} from 'lucide'

function iconSvg(iconDef: unknown): string {
  const attrs = `viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
  const inner = (iconDef as [string, Record<string, string>][])
    .map(([tag, a]) => `<${tag}${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`)
    .join('')
  return `<svg ${attrs}>${inner}</svg>`
}

const ICONS = {
  code: iconSvg(Code2),
  side: iconSvg(PanelLeft),
  top: iconSvg(ArrowUp),
  sun: iconSvg(Sun),
  moon: iconSvg(Moon),
  auto: iconSvg(Monitor),
  alignCenter: iconSvg(AlignCenter),
  alignLeft: iconSvg(AlignLeft),
  settings: iconSvg(Settings),
  search: iconSvg(Search),
}
// ---------------------------------------------------------------------------

// Register plugins
blockCopyPlugin()
imgViewerPlugin()
const eventBus = getEventBus()

function updateSplashTheme(data: StorageData): void {
  window.__mdReaderSplash?.setTheme(toSplashTheme(resolveTheme(data)))
}

function removeSplash(): void {
  window.__mdReaderSplash?.remove()
}

function injectKatexStyle(): void {
  if (document.getElementById(KATEX_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = KATEX_STYLE_ID
  style.textContent = katexCss.replaceAll('url(fonts/', `url(${chrome.runtime.getURL('assets/katex/fonts/')}`)
  HEAD.appendChild(style)
}

function resolveTheme(data: StorageData): ResolvedTheme {
  const mode = data.colorMode ?? 'light'
  const isDark = mode === 'auto' ? darkMQL.matches : mode === 'dark'
  if (isDark) {
    const t = data.darkTheme ?? 'default'
    return t === 'default' ? 'dark' : t
  }
  const t = data.lightTheme ?? 'default'
  return t === 'default' ? 'light' : t
}

function toSplashTheme(theme: ResolvedTheme): 'light' | 'dark' {
  return theme === 'light' ? 'light' : 'dark'
}

function setTheme(data: StorageData): void {
  HTML.setAttribute(ROOT_THEME_ATTR, resolveTheme(data))
}

function rerender(data: StorageData, mdContent: HTMLElement): void {
  const rawPre = document.body.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''
  mdContent.innerHTML = mdRender(mdRaw, {
    theme: resolveTheme(data),
    plugins: data.mdPlugins,
  })
}

function renderSidebar(
  side: HTMLElement,
  content: HTMLElement,
  slots?: {
    sideSwitch: HTMLElement
    fileTree: HTMLElement
    tocTree: HTMLElement
    tocList: HTMLElement
    fileTreeRootURL: string | null
    updateSideMode: (mode: 'files' | 'toc') => void
    sideMode: 'files' | 'toc'
  },
): void {
  const list = slots?.tocList ?? side
  list.innerHTML = ''
  buildTocTree(content).forEach((item) => list.appendChild(item.li))

  if (slots) {
    side.innerHTML = ''
    side.appendChild(slots.sideSwitch)
    if (slots.fileTreeRootURL) side.appendChild(slots.fileTree)
    side.appendChild(slots.tocTree)
    slots.updateSideMode(slots.sideMode)
  }
}

function createSidebar(): HTMLElement {
  const side = document.createElement('ul')
  side.className = CN.SIDE
  return side
}

function isDotEntry(entry: FileTreeEntry): boolean {
  return entry.name.startsWith('.')
}

function buildTocTree(content: HTMLElement): TocItem[] {
  const idCache: Record<string, number> = Object.create(null)
  const roots: TocItem[] = []
  const stack: TocItem[] = []

  Array.from(content.querySelectorAll<HTMLElement>(HEADERS)).forEach((head) => {
    const text = (head.textContent || '').replace(/^#/, '').trim()
    const encoded = (function unique(key: string): string {
      if (key in idCache) return unique(`${key}-${idCache[key]++}`)
      idCache[key] = 1
      return key
    })(encodeURIComponent(text.toLowerCase().replace(/\s+/g, '-')))
    const level = Number(head.tagName.slice(1))

    head.querySelector(`.${CN.HEAD_ANCHOR}`)?.remove()
    head.setAttribute('id', encoded)
    const anchor = document.createElement('a')
    anchor.className = CN.HEAD_ANCHOR
    anchor.href = `#${encoded}`
    anchor.textContent = '#'
    head.insertBefore(anchor, head.firstChild)

    const item: TocItem = {
      head,
      text,
      encoded,
      level,
      li: document.createElement('li'),
      children: [],
    }
    item.li.className = `${CN.SIDE}-${head.tagName.toLowerCase()} md-reader__toc-item`
    item.li.dataset.level = String(level)

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(item)
    else roots.push(item)
    stack.push(item)
  })

  roots.forEach(renderTocItem)
  return roots
}

function renderTocItem(item: TocItem): void {
  const row = document.createElement('div')
  row.className = 'md-reader__toc-row'

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'md-reader__toc-toggle'
  toggle.innerHTML = item.children.length ? '<span></span>' : ''
  toggle.disabled = !item.children.length

  const link = document.createElement('a')
  link.title = item.text
  link.href = `#${item.encoded}`
  link.textContent = item.text
  link.addEventListener('click', (e) => {
    e.preventDefault()
    item.head.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  row.append(toggle, link)
  item.li.appendChild(row)

  if (!item.children.length) return

  item.li.classList.add('expanded')
  const childList = document.createElement('ul')
  childList.className = 'md-reader__toc-children'
  item.children.forEach((child) => {
    renderTocItem(child)
    childList.appendChild(child.li)
  })
  toggle.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    item.li.classList.toggle('expanded')
  })
  item.li.appendChild(childList)
}

function setSidebarWidth(value: number): void {
  const width = Math.min(520, Math.max(220, Math.round(value)))
  HTML.style.setProperty(SIDE_WIDTH_VAR, `${width}px`)
}

function setContentFontSize(fontSize?: FontSize): void {
  const value = fontSize && FONT_SIZE_MAP[fontSize]
    ? FONT_SIZE_MAP[fontSize]
    : FONT_SIZE_MAP['Small']
  HTML.style.setProperty(CONTENT_FONT_SIZE_VAR, `${value}px`)
}

function getFileTreeRootURL(data: StorageData): string | null {
  const fallbackRoot = getParentDirectoryURL(window.location.href)
  if (!fallbackRoot) return null

  if (data.fileTreeRootURL && isFileInDirectory(window.location.href, data.fileTreeRootURL)) {
    return data.fileTreeRootURL
  }

  void storage.set(FILE_TREE_ROOT_STORAGE_KEY, fallbackRoot)
  return fallbackRoot
}

function getQueryFileURL(fileTreeRootURL: string | null): string | null {
  if (!fileTreeRootURL) return null

  const url = new URL(window.location.href)
  const value = url.searchParams.get(CURRENT_FILE_QUERY_KEY)
  if (!value) return null

  const fileURL = normalizeFileURL(value)
  return isFileInDirectory(fileURL, fileTreeRootURL) ? fileURL : null
}

// --- Mermaid lazy loading --------------------------------------------------
let mermaidGen = 0

async function renderMermaidDiagrams(container: HTMLElement, theme: ResolvedTheme): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>('.mermaid-placeholder')
  if (!placeholders.length) return

  const gen = ++mermaidGen
  const mermaid = (await import('mermaid')).default
  if (gen !== mermaidGen) return // a newer render superseded us

  mermaid.initialize({
    theme: theme === 'dark' || theme === 'nordic' ? 'dark' : 'default',
    themeVariables: undefined,
  })

  for (const el of Array.from(placeholders)) {
    if (gen !== mermaidGen) return
    if (!el.isConnected) continue
    const idx = Number(el.dataset.mermaidIdx ?? '-1')
    const raw = mermaidBlocks[idx]
    if (raw == null) continue
    try {
      const id = `mermaid-${gen}-${idx}`
      let svg = ''
      mermaid.mermaidAPI.render(id, raw, (sc: string) => { svg = sc })
      if (el.isConnected) {
        el.outerHTML = `<pre class="mermaid">${svg}</pre>`
      }
    } catch (err: any) {
      if (el.isConnected) {
        const msg = String(err?.message ?? err)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        el.outerHTML = `<pre class="mermaid-error">${msg}</pre>`
      }
    }
  }
}
// ---------------------------------------------------------------------------

export default function initContentScript(): void {
  init()
}

// Also expose via global for dynamic import without export issues
;(window as any).__mdReaderInit = initContentScript

async function init(): Promise<void> {
  const rawData = await storage.get()
  const data = getDefaultData(rawData)
  console.log('[md-reader] init — data:', JSON.stringify({ enable: data.enable, colorMode: data.colorMode, plugins: data.mdPlugins?.length }))
  updateSplashTheme(data)
  if (!data.enable) {
    removeSplash()
    return
  }

  injectKatexStyle()
  setTheme(data)
  setContentFontSize(data.fontSize)
  if (
    typeof data.sideWidth === 'number' &&
    data.sideWidth !== LEGACY_DEFAULT_SIDE_WIDTH &&
    data.sideWidth !== PREVIOUS_DEFAULT_SIDE_WIDTH &&
    data.sideWidth > PREVIOUS_DEFAULT_SIDE_WIDTH_MAX
  ) {
    setSidebarWidth(data.sideWidth)
  }
  BODY.classList.toggle(CN.SIDE_COLLAPSED, !!data.hiddenSide)

  const fileTreeRootURL = getFileTreeRootURL(data)
  const queryFileURL = getQueryFileURL(fileTreeRootURL)
  const rawPre = BODY.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''
  let currentFileURL = queryFileURL || normalizeFileURL(window.location.href)
  let currentRaw = mdRaw
  console.log('[md-reader] rawPre:', !!rawPre, 'mdRaw length:', mdRaw.length)

  // Content area
  const mdContent = document.createElement('article')
  mdContent.className = `${CN.CONTENT} ${data.centered ? CN.CENTERED : ''}`
  mdContent.innerHTML = mdRender(mdRaw, {
    theme: resolveTheme(data),
    plugins: data.mdPlugins,
  })
  void renderMermaidDiagrams(mdContent, resolveTheme(data))

  const rawContent = document.createElement('pre')
  rawContent.className = CN.RAW_CONTENT
  rawContent.textContent = mdRaw
  rawContent.hidden = true

  mdContent.addEventListener('click', (e) => {
    eventBus.emit('click', e.target, e)
  })

  // Main body
  const mdBody = document.createElement('main')
  mdBody.className = CN.BODY
  mdBody.append(mdContent, rawContent)

  // Sidebar
  const mdSide = createSidebar()
  const sideResizeHandle = document.createElement('div')
  sideResizeHandle.className = 'md-reader__side-resize-handle'
  const sideScroll = document.createElement('div')
  sideScroll.className = 'md-reader__side-scroll'
  const sideSwitch = document.createElement('li')
  sideSwitch.className = 'md-reader__side-switch'
  const searchWrap = document.createElement('li')
  searchWrap.className = 'md-reader__side-search-wrap'
  const fileTree = document.createElement('li')
  fileTree.className = 'md-reader__side-file-tree'
  const tocTree = document.createElement('li')
  tocTree.className = 'md-reader__side-toc'
  const tocList = document.createElement('ul')
  tocList.className = 'md-reader__toc-list'
  tocTree.appendChild(tocList)
  let sideMode: 'files' | 'toc' = fileTreeRootURL ? 'files' : 'toc'
  renderSideSwitch()
  if (fileTreeRootURL) renderFileTree(fileTreeRootURL)

  // Buttons
  const btnWrap = document.createElement('div')
  btnWrap.className = CN.BTN_WRAP

  const sideBtn = document.createElement('button')
  sideBtn.className = `${CN.BTN} ${CN.BTN_SIDE_EXPAND}`
  sideBtn.title = 'Toggle sidebar'
  sideBtn.innerHTML = ICONS.side
  sideBtn.addEventListener('click', () => {
    const value = window.innerWidth <= 960
      ? !BODY.classList.contains(CN.SIDE_EXPANDED)
      : !BODY.classList.contains(CN.SIDE_COLLAPSED)
    chrome.runtime.sendMessage({ action: 'storage', data: { key: 'hiddenSide', value } })
  })

  const rawBtn = document.createElement('button')
  rawBtn.className = `${CN.BTN} ${CN.BTN_CODE_TOGGLE}`
  rawBtn.title = 'Toggle raw'
  rawBtn.innerHTML = ICONS.code
  rawBtn.setAttribute('aria-pressed', 'false')
  rawBtn.addEventListener('click', () => {
    const showRaw = rawContent.hidden
    rawContent.hidden = !showRaw
    mdContent.hidden = showRaw
    rawBtn.setAttribute('aria-pressed', String(showRaw))
  })

  const themeBtn = document.createElement('button')
  themeBtn.className = `${CN.BTN} md-reader__btn--theme`
  themeBtn.title = 'Theme: auto'
  themeBtn.innerHTML = ICONS.auto
  themeBtn.addEventListener('click', () => {
    const modes: ColorMode[] = ['auto', 'light', 'dark']
    const current = data.colorMode ?? 'auto'
    const next = modes[(modes.indexOf(current) + 1) % modes.length]
    saveConfig('colorMode', next)
  })

  const alignBtn = document.createElement('button')
  alignBtn.className = `${CN.BTN} md-reader__btn--align`
  alignBtn.title = 'Toggle centered'
  alignBtn.innerHTML = ICONS.alignCenter
  alignBtn.addEventListener('click', () => {
    const centered = !data.centered
    data.centered = centered
    saveConfig('centered', centered)
    animateCenterToggle(centered)
    updateQuickButtons()
  })

  function updateQuickButtons(): void {
    const mode = data.colorMode ?? 'auto'
    themeBtn.innerHTML = mode === 'dark' ? ICONS.moon : mode === 'light' ? ICONS.sun : ICONS.auto
    themeBtn.title = `Theme: ${mode}`
    const centered = mdContent.classList.contains(CN.CENTERED)
    alignBtn.innerHTML = centered ? ICONS.alignCenter : ICONS.alignLeft
    alignBtn.title = centered ? 'Centered' : 'Left aligned'
  }
  updateQuickButtons()

  const topBtn = document.createElement('button')
  topBtn.className = `${CN.BTN} ${CN.BTN_GO_TOP}`
  topBtn.title = 'Go to top'
  topBtn.innerHTML = ICONS.top
  topBtn.style.display = 'none'
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  const optionsBtn = document.createElement('button')
  optionsBtn.className = `${CN.BTN} md-reader__btn--options`
  optionsBtn.title = 'Options'
  optionsBtn.innerHTML = ICONS.settings
  optionsBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    optionsMenu.classList.toggle('opened')
  })

  const optionsMenu = document.createElement('div')
  optionsMenu.className = 'md-reader__options-menu'
  optionsMenu.addEventListener('click', (e) => e.stopPropagation())
  renderOptionsMenu()
  document.addEventListener('click', () => optionsMenu.classList.remove('opened'))

  btnWrap.appendChild(sideBtn)
  btnWrap.appendChild(themeBtn)
  btnWrap.appendChild(alignBtn)
  btnWrap.appendChild(optionsBtn)
  btnWrap.appendChild(optionsMenu)
  btnWrap.appendChild(rawBtn)
  btnWrap.appendChild(topBtn)

  // Mount
  BODY.appendChild(btnWrap)
  BODY.appendChild(mdBody)
  BODY.appendChild(mdSide)
  initSideResize()

  // Scroll handler
  let sideHover = false
  let headEls: HTMLElement[] = []
  let sideLis: HTMLElement[] = []
  let targetIdx: number | null = null
  let reloading = false
  renderSide()

  sideScroll.addEventListener('mouseenter', () => { sideHover = true })
  sideScroll.addEventListener('mouseleave', () => { sideHover = false })

  document.addEventListener('scroll', throttle(() => {
    const scrollTop = document.documentElement.scrollTop
    topBtn.style.display = scrollTop >= 640 ? '' : 'none'

    for (let i = 0; i < headEls.length; i++) {
      let sectionTop = -20
      const next = headEls[i + 1]
      if (next) sectionTop += next.offsetTop
      const hit = sectionTop <= 0 || sectionTop > scrollTop
      if (hit && (targetIdx !== i || reloading)) {
        if (targetIdx !== null && sideLis[targetIdx]) {
          sideLis[targetIdx].classList.remove(CN.SIDE_ACTIVE)
        }
        const target = sideLis[i]
        targetIdx = i
        if (target) {
          target.classList.add(CN.SIDE_ACTIVE)
          if (!sideHover) target.scrollIntoView?.({ block: 'nearest' })
        }
      }
      if (hit) break
    }
  }, 100))

  // Dark mode media query
  darkMQL.addEventListener('change', (e) => {
    if (data.colorMode === 'auto') {
      setTheme(data)
      updateSplashTheme(data)
      renderMarkdown(currentRaw)
      renderToc()
      updateOptionsMenuState()
    }
  })

  // Window resize — reapply manual content width
  window.addEventListener('resize', throttle(() => {
    if (data.contentWidthMode === 'manual') applyContentWidth()
  }, 100))

  // Auto refresh
  let pollTimer: number | undefined
  if (data.refresh) {
    const poll = () => {
      chrome.runtime.sendMessage({ action: 'fetch', data: { url: currentFileURL } }, (res: string) => {
        if (res !== undefined) {
          if (currentRaw === undefined || currentRaw === null) {
            if (res) window.location.reload()
          } else if (currentRaw !== res) {
            currentRaw = res
            renderMarkdown(res)
            renderRaw(res)
            renderToc()
            if (rawPre) rawPre.textContent = res
          }
        }
        setTimeout(poll, 500)
      })
    }
    poll()
  }

  // Messages
  chrome.runtime.onMessage.addListener((msg: { action: string; data?: { key: string; value: unknown } }) => {
    const { action, data: msgData } = msg
    if (!msgData) return
    const key = msgData.key as keyof StorageData
    const value = msgData.value
    ;(data as Record<string, unknown>)[key] = value

    switch (action) {
      case 'reload': window.location.reload(); break
      case 'updateMdPlugins': reloading = true; renderMarkdown(currentRaw); renderToc(); reloading = false; break
      case 'updatePageTheme':
      case 'updateColorMode':
      case 'updateLightTheme':
      case 'updateDarkTheme': {
        const prev = HTML.getAttribute(ROOT_THEME_ATTR)
        setTheme(data)
        const next = resolveTheme(data)
        if (data.mdPlugins?.includes('Mermaid') && prev !== next) {
          renderMarkdown(currentRaw)
          renderToc()
        }
        updateOptionsMenuState()
        updateQuickButtons()
        break
      }
      case 'updateFileTreeOptions': if (fileTreeRootURL) renderFileTree(fileTreeRootURL); updateOptionsMenuState(); break
      case 'updateCodeTheme': renderMarkdown(currentRaw); renderToc(); break
      case 'updateFontSize':
        setContentFontSize(value as FontSize)
        updateOptionsMenuState()
        break
      case 'toggleRefresh': clearTimeout(pollTimer); if (value) window.location.reload(); break
      case 'toggleCentered': data.centered = !!value; animateCenterToggle(!!value); updateQuickButtons(); break
      case 'updateContentWidthMode':
      case 'updateContentWidthPercent': applyContentWidth(); updateOptionsMenuState(); break
      case 'toggleSide': {
        if (window.innerWidth <= 960) {
          const expanded = BODY.classList.toggle(CN.SIDE_EXPANDED)
          if (expanded) {
            const close = (e: Event) => {
              if (e.type === 'keydown' && (e as KeyboardEvent).code !== 'Escape') return
              BODY.classList.remove(CN.SIDE_EXPANDED)
              mdBody.removeEventListener('click', close, { capture: true })
              window.removeEventListener('resize', close)
              document.removeEventListener('keydown', close)
            }
            setTimeout(() => {
              mdBody.addEventListener('click', close, { capture: true, once: true })
              window.addEventListener('resize', close, { once: true })
              document.addEventListener('keydown', close, { once: true })
            }, 0)
          }
        } else {
          BODY.classList.toggle(CN.SIDE_COLLAPSED)
        }
        setTimeout(() => applyContentWidth(), 350)
        break
      }
    }
  })

  // Favicon + meta
  const meta = document.createElement('meta')
  meta.name = 'referrer'
  meta.content = 'no-referrer'
  HEAD.appendChild(meta)

  // Set tab favicon to the extension logo
  const existingIcon = HEAD.querySelector('link[rel~="icon"]')
  if (!existingIcon) {
    const icon = document.createElement('link')
    icon.rel = 'icon'
    icon.type = 'image/png'
    icon.href = chrome.runtime.getURL('assets/logo-stroke.png')
    HEAD.appendChild(icon)
  } else {
    existingIcon.setAttribute('href', chrome.runtime.getURL('assets/logo-stroke.png'))
  }
  BODY.classList.add('md-reader')
  applyContentWidth()
  if (queryFileURL) {
    await openMarkdownFile(queryFileURL, { updateHistory: false })
  }
  removeSplash()

  function renderMarkdown(raw: string): void {
    mdContent.innerHTML = mdRender(raw, {
      theme: resolveTheme(data),
      plugins: data.mdPlugins,
    })
    void renderMermaidDiagrams(mdContent, resolveTheme(data))
  }

  function renderRaw(raw: string): void {
    rawContent.textContent = raw
  }

  function renderSide(): void {
    renderToc()
    sideScroll.innerHTML = ''
    sideScroll.appendChild(sideSwitch)
    sideScroll.appendChild(searchWrap)
    if (fileTreeRootURL) sideScroll.appendChild(fileTree)
    sideScroll.appendChild(tocTree)
    mdSide.innerHTML = ''
    mdSide.appendChild(sideScroll)
    mdSide.appendChild(sideResizeHandle)
    updateSideMode(sideMode)
  }

  function renderToc(): void {
    tocList.innerHTML = ''
    buildTocTree(mdContent).forEach((item) => tocList.appendChild(item.li))
    headEls = Array.from(mdContent.querySelectorAll<HTMLElement>(HEADERS))
    sideLis = Array.from(tocList.querySelectorAll<HTMLElement>('.md-reader__toc-item'))
    targetIdx = null
  }

  function initSideResize(): void {
    let startX = 0
    let startWidth = 0

    const onMove = (event: PointerEvent) => {
      setSidebarWidth(startWidth + event.clientX - startX)
    }
    const onEnd = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
      BODY.classList.remove('md-reader--resizing-side')
      const width = Math.round(mdSide.getBoundingClientRect().width)
      chrome.runtime.sendMessage({
        action: 'storage',
        data: { key: SIDE_WIDTH_STORAGE_KEY, value: width },
      })
    }

    sideResizeHandle.addEventListener('pointerdown', (event) => {
      if (window.innerWidth <= 960) return
      startX = event.clientX
      startWidth = mdSide.getBoundingClientRect().width
      BODY.classList.add('md-reader--resizing-side')
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onEnd, { once: true })
      event.preventDefault()
    })
  }

  function renderSideSwitch(): void {
    sideSwitch.innerHTML = ''
    sideSwitch.className = 'md-reader__side-header'
    const switcher = document.createElement('div')
    switcher.className = 'md-reader__side-switch-control'
    switcher.append(
      createSideSwitchButton('files', 'Files'),
      createSideSwitchButton('toc', 'TOC'),
    )

    const searchBtn = document.createElement('button')
    searchBtn.type = 'button'
    searchBtn.className = 'md-reader__side-search-btn'
    searchBtn.title = 'Filter'
    searchBtn.innerHTML = ICONS.search

    searchWrap.className = 'md-reader__side-search-wrap'
    searchWrap.innerHTML = ''
    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.className = 'md-reader__side-search-input'
    searchInput.placeholder = 'Filter...'
    searchWrap.appendChild(searchInput)

    searchBtn.addEventListener('click', () => {
      const opening = !searchWrap.classList.contains('open')
      searchWrap.classList.toggle('open', opening)
      searchBtn.classList.toggle('active', opening)
      if (opening) {
        searchInput.focus()
      } else {
        searchInput.value = ''
        applyFilter('')
      }
    })

    searchInput.addEventListener('input', () => {
      applyFilter(searchInput.value.trim())
    })

    sideSwitch.append(switcher, searchBtn)
  }

  function applyFilter(query: string): void {
    const q = query.toLowerCase()
    if (sideMode === 'files') {
      filterFileTree(q)
    } else {
      filterToc(q)
    }
  }

  function ensureDirLoaded(item: HTMLElement): Promise<void> {
    const childList = item.querySelector<HTMLElement>(':scope > .md-reader__file-tree-list')
    if (!childList || childList.dataset.loaded === 'true') return Promise.resolve()
    const dirUrl = item.dataset.dirUrl
    if (!dirUrl) return Promise.resolve()
    childList.dataset.loaded = 'true'
    item.classList.add('expanded')
    childList.hidden = false
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'directory', data: { url: dirUrl } },
        (html: string) => {
          if (!html || chrome.runtime.lastError) {
            childList.innerHTML = ''
            resolve()
            return
          }
          const entries = parseDirectoryListing(html, dirUrl).filter(
            (entry) => !data.hideDotFiles || !isDotEntry(entry),
          )
          childList.innerHTML = ''
          entries.forEach((entry) => childList.appendChild(renderFileTreeEntry(entry)))
          resolve()
        },
      )
    })
  }

  async function filterFileTree(q: string): Promise<void> {
    if (!q) {
      fileTree.querySelectorAll<HTMLElement>('.md-reader__file-tree-item').forEach((item) => item.style.display = '')
      return
    }
    // First, recursively load all unloaded directories
    await loadAllDirs(fileTree)
    // Now filter
    const items = fileTree.querySelectorAll<HTMLElement>('.md-reader__file-tree-item')
    items.forEach((item) => {
      const nameEl = item.querySelector<HTMLElement>(':scope > a .md-reader__file-tree-name, :scope > button .md-reader__file-tree-name')
      const name = nameEl?.textContent?.toLowerCase() ?? ''
      const isDir = item.classList.contains('md-reader__file-tree-item--directory')
      if (!isDir) {
        item.style.display = name.includes(q) ? '' : 'none'
      } else {
        const hasVisibleChild = Array.from(item.querySelectorAll<HTMLElement>(':scope .md-reader__file-tree-item--file'))
          .some((child) => {
            const childName = child.querySelector<HTMLElement>('.md-reader__file-tree-name')?.textContent?.toLowerCase() ?? ''
            return childName.includes(q)
          })
        const selfMatch = name.includes(q)
        item.style.display = (selfMatch || hasVisibleChild) ? '' : 'none'
        if (hasVisibleChild) {
          item.classList.add('expanded')
          const childList = item.querySelector<HTMLElement>(':scope > .md-reader__file-tree-list')
          if (childList) childList.hidden = false
        }
      }
    })
  }

  async function loadAllDirs(container: HTMLElement): Promise<void> {
    const unloaded = container.querySelectorAll<HTMLElement>('.md-reader__file-tree-item--directory')
    const promises: Promise<void>[] = []
    unloaded.forEach((item) => {
      const childList = item.querySelector<HTMLElement>(':scope > .md-reader__file-tree-list')
      if (childList && childList.dataset.loaded !== 'true') {
        promises.push(
          ensureDirLoaded(item).then(() => loadAllDirs(item)),
        )
      }
    })
    await Promise.all(promises)
  }

  function filterToc(q: string): void {
    const items = tocList.querySelectorAll<HTMLElement>('.md-reader__toc-item')
    if (!q) {
      items.forEach((item) => item.style.display = '')
      return
    }
    items.forEach((item) => {
      const linkEl = item.querySelector<HTMLElement>(':scope > .md-reader__toc-row a')
      const text = linkEl?.textContent?.toLowerCase() ?? ''
      const hasMatchingChild = Array.from(item.querySelectorAll<HTMLElement>(':scope .md-reader__toc-item'))
        .some((child) => {
          const childLink = child.querySelector<HTMLElement>(':scope > .md-reader__toc-row a')
          return (childLink?.textContent?.toLowerCase() ?? '').includes(q)
        })
      item.style.display = (text.includes(q) || hasMatchingChild) ? '' : 'none'
      if (hasMatchingChild) {
        item.classList.add('expanded')
        const childList = item.querySelector<HTMLElement>(':scope > .md-reader__toc-children')
        if (childList) childList.style.display = ''
      }
    })
  }

  function createSideSwitchButton(mode: 'files' | 'toc', label: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.mode = mode
    button.textContent = label
    button.disabled = mode === 'files' && !fileTreeRootURL
    button.addEventListener('click', () => updateSideMode(mode))
    return button
  }

  function updateSideMode(mode: 'files' | 'toc'): void {
    sideMode = mode === 'files' && !fileTreeRootURL ? 'toc' : mode
    fileTree.classList.toggle('active', sideMode === 'files')
    tocTree.classList.toggle('active', sideMode === 'toc')
    sideSwitch.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === sideMode)
    })
  }

  function renderFileTree(rootURL: string): void {
    fileTree.innerHTML = ''
    const title = document.createElement('div')
    title.className = 'md-reader__file-tree-title md-reader__file-tree-title--clickable'
    title.textContent = getFileName(rootURL) || 'Files'
    title.title = 'Click to expand all / collapse to first layer'
    title.style.cursor = 'pointer'
    let allExpanded = false
    title.addEventListener('click', async () => {
      if (!allExpanded) {
        await loadAllDirs(fileTree)
        fileTree.querySelectorAll<HTMLElement>('.md-reader__file-tree-item--directory').forEach((item) => {
          item.classList.add('expanded')
          const childList = item.querySelector<HTMLElement>(':scope > .md-reader__file-tree-list')
          if (childList) childList.hidden = false
        })
        allExpanded = true
      } else {
        fileTree.querySelectorAll<HTMLElement>('.md-reader__file-tree-item--directory').forEach((item) => {
          item.classList.remove('expanded')
          const childList = item.querySelector<HTMLElement>(':scope > .md-reader__file-tree-list')
          if (childList) childList.hidden = true
        })
        allExpanded = false
      }
    })

    const list = document.createElement('ul')
    list.className = 'md-reader__file-tree-list'
    fileTree.append(title, list)
    loadFileTreeDirectory(rootURL, list)
  }

  function loadFileTreeDirectory(directoryURL: string, list: HTMLElement): void {
    list.textContent = 'Loading...'
    chrome.runtime.sendMessage(
      { action: 'directory', data: { url: directoryURL } },
      (html: string) => {
        if (!html || chrome.runtime.lastError) {
          list.textContent = 'Unable to load files'
          return
        }

        const entries = parseDirectoryListing(html, directoryURL).filter(
          (entry) => !data.hideDotFiles || !isDotEntry(entry),
        )
        list.innerHTML = ''
        if (!entries.length) {
          list.textContent = 'No markdown files'
          return
        }

        entries.forEach((entry) => list.appendChild(renderFileTreeEntry(entry)))
      },
    )
  }

  function renderFileTreeEntry(entry: FileTreeEntry): HTMLElement {
    const item = document.createElement('li')
    item.className = `md-reader__file-tree-item md-reader__file-tree-item--${entry.type}`

    if (entry.type === 'directory') {
      item.dataset.dirUrl = entry.url
      const button = document.createElement('button')
      const childList = document.createElement('ul')
      childList.className = 'md-reader__file-tree-list'
      childList.hidden = true
      button.type = 'button'
      button.innerHTML = '<span class="md-reader__file-tree-caret">▸</span><span class="md-reader__file-tree-icon">□</span><span class="md-reader__file-tree-name"></span>'
      button.querySelector('.md-reader__file-tree-name')!.textContent = entry.name
      const containsCurrentFile = isFileInDirectory(currentFileURL, entry.url)
      if (containsCurrentFile) {
        item.classList.add('expanded')
        childList.hidden = false
        childList.dataset.loaded = 'true'
        loadFileTreeDirectory(entry.url, childList)
      }
      button.addEventListener('click', () => {
        const expanded = item.classList.toggle('expanded')
        childList.hidden = !expanded
        if (expanded && !childList.dataset.loaded) {
          childList.dataset.loaded = 'true'
          loadFileTreeDirectory(entry.url, childList)
        }
      })
      item.append(button, childList)
      return item
    }

    const link = document.createElement('a')
    link.href = entry.url
    link.innerHTML = '<span class="md-reader__file-tree-spacer"></span><span class="md-reader__file-tree-icon">M</span><span class="md-reader__file-tree-name"></span>'
    link.querySelector('.md-reader__file-tree-name')!.textContent = entry.name
    if (normalizeFileURL(entry.url) === currentFileURL) item.classList.add('active')
    link.addEventListener('click', async (event) => {
      if (!fileTreeRootURL) return
      event.preventDefault()
      await storage.set(FILE_TREE_ROOT_STORAGE_KEY, fileTreeRootURL)
      void openMarkdownFile(entry.url)
    })
    item.appendChild(link)
    return item
  }

  function updateFileTreeActive(url: string): void {
    const targetURL = normalizeFileURL(url)
    fileTree.querySelectorAll<HTMLElement>('.md-reader__file-tree-item.active').forEach((item) => {
      item.classList.remove('active')
    })
    fileTree.querySelectorAll<HTMLAnchorElement>('.md-reader__file-tree-item--file > a').forEach((link) => {
      if (normalizeFileURL(link.href) === targetURL) {
        link.closest('.md-reader__file-tree-item')?.classList.add('active')
      }
    })
  }

  function readMarkdownFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'readFile', data: { url } }, (res: string) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(res)
      })
    })
  }

  function updateLocationForCurrentFile(url: string): void {
    try {
      history.pushState({ mdReaderFileURL: currentFileURL }, '', url)
      return
    } catch {
      // file:// pages can reject cross-path pushState; keep the current document URL.
    }

    const currentURL = new URL(window.location.href)
    currentURL.searchParams.set(CURRENT_FILE_QUERY_KEY, url)
    try {
      history.pushState({ mdReaderFileURL: currentFileURL }, '', currentURL.href)
    } catch {
      // URL updates are best-effort; content switching should still work.
    }
  }

  async function openMarkdownFile(url: string, options: { updateHistory?: boolean } = {}): Promise<void> {
    try {
      const raw = await readMarkdownFile(url)
      currentFileURL = normalizeFileURL(url)
      currentRaw = raw
      renderMarkdown(raw)
      renderRaw(raw)
      renderToc()
      updateFileTreeActive(currentFileURL)
      if (rawPre) rawPre.textContent = raw
      if (options.updateHistory !== false) updateLocationForCurrentFile(url)
      window.scrollTo({ top: 0 })
    } catch (err) {
      console.error('[md-reader] Failed to open markdown file:', err)
    }
  }

  function renderOptionsMenu(): void {
    optionsMenu.innerHTML = `
      <div class="md-reader__options-title">Options</div>
      <label class="md-reader__options-row">
        <span>
          <strong>Hide dotfiles</strong>
          <small>Hide files and folders starting with a dot.</small>
        </span>
        <input type="checkbox" data-option="hideDotFiles" />
      </label>
      <div class="md-reader__options-group">
        <div class="md-reader__options-slider-head">
          <div class="md-reader__options-label">Font size</div>
          <output data-font-size-output></output>
        </div>
        <input
          class="md-reader__options-slider"
          type="range"
          min="0"
          max="${Object.keys(FONT_SIZE_MAP).length - 1}"
          step="1"
          data-option="fontSize"
        />
      </div>
      <div class="md-reader__options-group">
        <div class="md-reader__options-label">Alignment</div>
        <div class="md-reader__side-switch-control" data-align-switch>
          <button type="button" data-align="left">Left</button>
          <button type="button" data-align="center">Center</button>
        </div>
      </div>
      <div class="md-reader__options-group">
        <div class="md-reader__options-label">Appearance</div>
        <div class="md-reader__options-theme">
          <button type="button" data-color-mode="light">Light</button>
          <button type="button" data-color-mode="dark">Dark</button>
          <button type="button" data-color-mode="auto">Auto</button>
        </div>
        <div class="md-reader__options-theme-variants">
          <div class="md-reader__options-variant-row">
            <span>Light theme</span>
            <select data-theme-variant="light">
              ${LIGHT_THEMES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="md-reader__options-variant-row">
            <span>Dark theme</span>
            <select data-theme-variant="dark">
              ${DARK_THEMES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="md-reader__options-group">
        <div class="md-reader__options-label">Content width</div>
        <div class="md-reader__side-switch-control" data-width-mode-switch>
          <button type="button" data-width-mode="auto">Auto</button>
          <button type="button" data-width-mode="manual">Manual</button>
        </div>
        <div class="md-reader__options-slider-head" data-width-slider-head style="margin-top:10px">
          <div class="md-reader__options-label" style="margin-bottom:0">Width</div>
          <output data-width-output></output>
        </div>
        <input
          class="md-reader__options-slider"
          type="range"
          min="20"
          max="100"
          step="1"
          data-option="contentWidth"
        />
      </div>
    `

    const hideDotFiles = optionsMenu.querySelector<HTMLInputElement>('[data-option="hideDotFiles"]')
    hideDotFiles?.addEventListener('change', () => {
      saveConfig('hideDotFiles', !!hideDotFiles.checked)
    })
    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-color-mode]').forEach((button) => {
      button.addEventListener('click', () => saveConfig('colorMode', button.dataset.colorMode as ColorMode))
    })
    optionsMenu.querySelectorAll<HTMLSelectElement>('[data-theme-variant]').forEach((select) => {
      select.addEventListener('change', () => {
        if (select.dataset.themeVariant === 'light') saveConfig('lightTheme', select.value as LightTheme)
        else saveConfig('darkTheme', select.value as DarkTheme)
      })
    })
    const fontSlider = optionsMenu.querySelector<HTMLInputElement>('[data-option="fontSize"]')
    fontSlider?.addEventListener('input', () => {
      const fontSize = getFontSizeAtIndex(Number(fontSlider.value))
      setContentFontSize(fontSize)
      data.fontSize = fontSize
      updateOptionsMenuState()
    })
    fontSlider?.addEventListener('change', () => {
      saveConfig('fontSize', getFontSizeAtIndex(Number(fontSlider.value)))
    })

    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-align]').forEach((button) => {
      button.addEventListener('click', () => {
        const centered = button.dataset.align === 'center'
        data.centered = centered
        saveConfig('centered', centered)
        animateCenterToggle(centered)
        updateQuickButtons()
        updateOptionsMenuState()
      })
    })

    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-width-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.widthMode as ContentWidthMode
        data.contentWidthMode = mode
        saveConfig('contentWidthMode', mode)
        applyContentWidth()
        updateOptionsMenuState()
      })
    })

    const widthSlider = optionsMenu.querySelector<HTMLInputElement>('[data-option="contentWidth"]')
    widthSlider?.addEventListener('input', () => {
      const percent = Number(widthSlider.value)
      data.contentWidthPercent = percent
      applyContentWidth()
      updateOptionsMenuState()
    })
    widthSlider?.addEventListener('change', () => {
      saveConfig('contentWidthPercent', Number(widthSlider.value))
    })

    updateOptionsMenuState()
  }

  function updateOptionsMenuState(): void {
    const hideDotFiles = optionsMenu.querySelector<HTMLInputElement>('[data-option="hideDotFiles"]')
    if (hideDotFiles) hideDotFiles.checked = !!data.hideDotFiles
    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-color-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.colorMode === (data.colorMode ?? 'light'))
    })
    const lightVariantRow = optionsMenu.querySelector<HTMLElement>('[data-theme-variant="light"]')?.closest<HTMLElement>('.md-reader__options-variant-row')
    const darkVariantRow = optionsMenu.querySelector<HTMLElement>('[data-theme-variant="dark"]')?.closest<HTMLElement>('.md-reader__options-variant-row')
    const lightSelect = optionsMenu.querySelector<HTMLSelectElement>('[data-theme-variant="light"]')
    if (lightSelect) lightSelect.value = data.lightTheme ?? 'default'
    const darkSelect = optionsMenu.querySelector<HTMLSelectElement>('[data-theme-variant="dark"]')
    if (darkSelect) darkSelect.value = data.darkTheme ?? 'default'
    const mode = data.colorMode ?? 'auto'
    if (lightVariantRow) lightVariantRow.style.display = (mode === 'light' || mode === 'auto') ? '' : 'none'
    if (darkVariantRow) darkVariantRow.style.display = (mode === 'dark' || mode === 'auto') ? '' : 'none'
    const fontSizes = Object.keys(FONT_SIZE_MAP) as FontSize[]
    const fontSize = data.fontSize || 'Small'
    const fontSlider = optionsMenu.querySelector<HTMLInputElement>('[data-option="fontSize"]')
    if (fontSlider) fontSlider.value = String(Math.max(0, fontSizes.indexOf(fontSize)))
    const fontSizeOutput = optionsMenu.querySelector<HTMLOutputElement>('[data-font-size-output]')
    if (fontSizeOutput) fontSizeOutput.value = fontSize

    const widthMode = data.contentWidthMode ?? 'auto'
    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-align]').forEach((button) => {
      button.classList.toggle('active', button.dataset.align === (data.centered ? 'center' : 'left'))
    })
    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-width-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.widthMode === widthMode)
    })
    const widthSliderHead = optionsMenu.querySelector<HTMLElement>('[data-width-slider-head]')
    const widthSlider = optionsMenu.querySelector<HTMLInputElement>('[data-option="contentWidth"]')
    const widthOutput = optionsMenu.querySelector<HTMLOutputElement>('[data-width-output]')
    const isManual = widthMode === 'manual'
    if (widthSliderHead) widthSliderHead.style.display = isManual ? '' : 'none'
    if (widthSlider) { widthSlider.value = String(data.contentWidthPercent ?? 100); widthSlider.style.display = isManual ? '' : 'none' }
    if (widthOutput) widthOutput.value = `${data.contentWidthPercent ?? 100}%`
  }

  function getFontSizeAtIndex(index: number): FontSize {
    const fontSizes = Object.keys(FONT_SIZE_MAP) as FontSize[]
    return fontSizes[Math.min(fontSizes.length - 1, Math.max(0, index))] || 'Normal'
  }

  function applyContentWidth(): void {
    const mode = data.contentWidthMode ?? 'auto'
    if (mode === 'auto') {
      mdContent.style.removeProperty('max-width')
      mdContent.style.removeProperty('margin-left')
      mdContent.style.removeProperty('margin-right')
      mdContent.classList.toggle(CN.CENTERED, !!data.centered)
    } else {
      mdContent.classList.remove(CN.CENTERED)
      const pct = (data.contentWidthPercent ?? 100) / 100
      const paddingLeft = parseFloat(getComputedStyle(mdBody).paddingLeft) || 0
      const available = mdBody.offsetWidth - paddingLeft
      const w = Math.round(available * pct)
      mdContent.style.maxWidth = `${w}px`
      mdContent.style.marginLeft = data.centered ? 'auto' : '0'
      mdContent.style.marginRight = 'auto'
    }
  }

  let centerAnim: Animation | undefined

  /** Animate position change when toggling center/left alignment. */
  function animateCenterToggle(targetCentered: boolean): void {
    centerAnim?.cancel()
    // 1. Record current visual position
    const beforeLeft = mdContent.getBoundingClientRect().left
    // 2. Apply the actual layout change
    applyContentWidth()
    // 3. Record new position
    const afterLeft = mdContent.getBoundingClientRect().left
    const delta = beforeLeft - afterLeft
    if (Math.abs(delta) < 1) return
    // 4. Shift back to old position via transform, then animate to 0
    mdContent.style.transform = `translateX(${delta}px)`
    // Force reflow so the starting transform is applied
    mdContent.getBoundingClientRect()
    mdContent.style.transition = 'transform 0.25s ease-out'
    mdContent.style.transform = 'translateX(0)'
    const cleanup = () => {
      mdContent.style.removeProperty('transform')
      mdContent.style.removeProperty('transition')
    }
    mdContent.addEventListener('transitionend', cleanup, { once: true })
    // Fallback in case transitionend doesn't fire
    setTimeout(cleanup, 300)
  }

  function saveConfig<K extends keyof StorageData>(key: K, value: StorageData[K]): void {
    chrome.runtime.sendMessage({ action: 'storage', data: { key, value } })
  }
}
