// Heavy renderer entry — loaded dynamically by the thin content script
import throttle from 'lodash.throttle'
import { storage } from '@/shared/storage'
import { mdRender } from './renderer'
import { FONT_SIZE_MAP, getDefaultData } from '@/shared/types'
import type { FontSize, StorageData, Theme } from '@/shared/types'
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
type ResolvedTheme = Exclude<Theme, 'auto'>

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

const ICONS = {
  code: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  side: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-13C4.67 20 4 19.33 4 18.5v-13Z"/><path d="M9 4v16"/></svg>',
  top: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
}

// Register plugins
blockCopyPlugin()
imgViewerPlugin()
const eventBus = getEventBus()

function updateSplashTheme(theme: Theme): void {
  window.__mdReaderSplash?.setTheme(toSplashTheme(toTheme(theme)))
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

function toTheme(theme: Theme): ResolvedTheme {
  return theme === 'auto' ? (darkMQL.matches ? 'dark' : 'light') : theme
}

function toSplashTheme(theme: ResolvedTheme): 'light' | 'dark' {
  return theme === 'light' ? 'light' : 'dark'
}

function setTheme(theme: Theme): void {
  HTML.setAttribute(ROOT_THEME_ATTR, toTheme(theme))
}

function rerender(data: StorageData, mdContent: HTMLElement): void {
  const rawPre = document.body.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''
  mdContent.innerHTML = mdRender(mdRaw, {
    theme: toTheme(data.pageTheme || 'light'),
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

export default function initContentScript(): void {
  init()
}

// Also expose via global for dynamic import without export issues
;(window as any).__mdReaderInit = initContentScript

async function init(): Promise<void> {
  const rawData = await storage.get()
  const data = getDefaultData(rawData)
  console.log('[md-reader] init — data:', JSON.stringify({ enable: data.enable, theme: data.pageTheme, plugins: data.mdPlugins?.length }))
  updateSplashTheme(data.pageTheme || 'light')
  if (!data.enable) {
    removeSplash()
    return
  }

  injectKatexStyle()
  setTheme(data.pageTheme || 'light')
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
    theme: toTheme(data.pageTheme || 'light'),
    plugins: data.mdPlugins,
  })

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
  const sideSwitch = document.createElement('li')
  sideSwitch.className = 'md-reader__side-switch'
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

  const topBtn = document.createElement('button')
  topBtn.className = `${CN.BTN} ${CN.BTN_GO_TOP}`
  topBtn.title = 'Go to top'
  topBtn.innerHTML = ICONS.top
  topBtn.style.display = 'none'
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  const optionsBtn = document.createElement('button')
  optionsBtn.className = `${CN.BTN} md-reader__btn--options`
  optionsBtn.title = 'Options'
  optionsBtn.innerHTML = '<span></span><span></span><span></span>'
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
  btnWrap.appendChild(rawBtn)
  btnWrap.appendChild(optionsBtn)
  btnWrap.appendChild(optionsMenu)
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

  mdSide.addEventListener('mouseenter', () => { sideHover = true })
  mdSide.addEventListener('mouseleave', () => { sideHover = false })

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
    if (data.pageTheme === 'auto') {
      setTheme('auto')
      updateSplashTheme('auto')
      renderMarkdown(currentRaw)
      renderToc()
      updateOptionsMenuState()
    }
  })

  // Auto refresh
  let pollTimer: number | undefined
  if (data.refresh) {
    const poll = async () => {
      try {
        const res = await fetch(currentFileURL)
        if (res.ok) {
          const text = await res.text()
          if (currentRaw === undefined || currentRaw === null) {
            if (text) window.location.reload()
          } else if (currentRaw !== text) {
            currentRaw = text
            renderMarkdown(text)
            renderRaw(text)
            renderToc()
            if (rawPre) rawPre.textContent = text
          }
        }
      } catch {
        // ignore transient fetch errors
      }
      setTimeout(poll, 500)
    }
    void poll()
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
      case 'updatePageTheme': {
        const prev = HTML.getAttribute(ROOT_THEME_ATTR)
        setTheme(value as Theme)
        const next = toTheme(value as Theme)
        if (data.mdPlugins?.includes('Mermaid') && prev !== next) {
          renderMarkdown(currentRaw)
          renderToc()
        }
        updateOptionsMenuState()
        break
      }
      case 'updateFileTreeOptions': if (fileTreeRootURL) renderFileTree(fileTreeRootURL); updateOptionsMenuState(); break
      case 'updateCodeTheme': renderMarkdown(currentRaw); renderToc(); break
      case 'updateFontSize':
        setContentFontSize(value as FontSize)
        updateOptionsMenuState()
        break
      case 'toggleRefresh': clearTimeout(pollTimer); if (value) window.location.reload(); break
      case 'toggleCentered': mdContent.classList.toggle(CN.CENTERED, !!value); break
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
        break
      }
    }
  })

  // Favicon + meta
  const meta = document.createElement('meta')
  meta.name = 'referrer'
  meta.content = 'no-referrer'
  HEAD.appendChild(meta)
  BODY.classList.add('md-reader')
  if (queryFileURL) {
    await openMarkdownFile(queryFileURL, { updateHistory: false })
  }
  removeSplash()

  function renderMarkdown(raw: string): void {
    mdContent.innerHTML = mdRender(raw, {
      theme: toTheme(data.pageTheme || 'light'),
      plugins: data.mdPlugins,
    })
  }

  function renderRaw(raw: string): void {
    rawContent.textContent = raw
  }

  function renderSide(): void {
    renderToc()
    mdSide.innerHTML = ''
    mdSide.appendChild(sideSwitch)
    if (fileTreeRootURL) mdSide.appendChild(fileTree)
    mdSide.appendChild(tocTree)
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
    const switcher = document.createElement('div')
    switcher.className = 'md-reader__side-switch-control'
    switcher.append(
      createSideSwitchButton('files', 'Files'),
      createSideSwitchButton('toc', 'TOC'),
    )
    sideSwitch.appendChild(switcher)
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
    title.className = 'md-reader__file-tree-title'
    title.textContent = getFileName(rootURL) || 'Files'

    const list = document.createElement('ul')
    list.className = 'md-reader__file-tree-list'
    fileTree.append(title, list)
    loadFileTreeDirectory(rootURL, list)
  }

  function loadFileTreeDirectory(directoryURL: string, list: HTMLElement): void {
    list.textContent = 'Loading...'
    fetch(directoryURL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((html) => {
        const entries = parseDirectoryListing(html, directoryURL).filter(
          (entry) => !data.hideDotFiles || !isDotEntry(entry),
        )
        list.innerHTML = ''
        if (!entries.length) {
          list.textContent = 'No markdown files'
          return
        }
        entries.forEach((entry) => list.appendChild(renderFileTreeEntry(entry)))
      })
      .catch(() => {
        list.textContent = 'Unable to load files'
      })
  }

  function renderFileTreeEntry(entry: FileTreeEntry): HTMLElement {
    const item = document.createElement('li')
    item.className = `md-reader__file-tree-item md-reader__file-tree-item--${entry.type}`

    if (entry.type === 'directory') {
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

  async function readMarkdownFile(url: string): Promise<string> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
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
        <div class="md-reader__options-label">Theme</div>
        <div class="md-reader__options-theme">
          <button type="button" data-theme="light">Light</button>
          <button type="button" data-theme="dark">Dark</button>
          <button type="button" data-theme="nordic">Nordic</button>
          <button type="button" data-theme="auto">Auto</button>
        </div>
      </div>
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
    `

    const hideDotFiles = optionsMenu.querySelector<HTMLInputElement>('[data-option="hideDotFiles"]')
    hideDotFiles?.addEventListener('change', () => {
      saveConfig('hideDotFiles', !!hideDotFiles.checked)
    })
    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => {
      button.addEventListener('click', () => saveConfig('pageTheme', button.dataset.theme as Theme))
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
    updateOptionsMenuState()
  }

  function updateOptionsMenuState(): void {
    const hideDotFiles = optionsMenu.querySelector<HTMLInputElement>('[data-option="hideDotFiles"]')
    if (hideDotFiles) hideDotFiles.checked = !!data.hideDotFiles
    optionsMenu.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => {
      button.classList.toggle('active', button.dataset.theme === data.pageTheme)
    })
    const fontSizes = Object.keys(FONT_SIZE_MAP) as FontSize[]
    const fontSize = data.fontSize || 'Small'
    const fontSlider = optionsMenu.querySelector<HTMLInputElement>('[data-option="fontSize"]')
    if (fontSlider) fontSlider.value = String(Math.max(0, fontSizes.indexOf(fontSize)))
    const fontSizeOutput = optionsMenu.querySelector<HTMLOutputElement>('[data-font-size-output]')
    if (fontSizeOutput) fontSizeOutput.value = fontSize
  }

  function getFontSizeAtIndex(index: number): FontSize {
    const fontSizes = Object.keys(FONT_SIZE_MAP) as FontSize[]
    return fontSizes[Math.min(fontSizes.length - 1, Math.max(0, index))] || 'Normal'
  }

  function saveConfig<K extends keyof StorageData>(key: K, value: StorageData[K]): void {
    chrome.runtime.sendMessage({ action: 'storage', data: { key, value } })
  }
}
