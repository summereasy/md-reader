import throttle from 'lodash.throttle'
import { storage } from '@/shared/storage'
import { mdRender } from './renderer'
import { getDefaultData } from '@/shared/types'
import type { StorageData, Theme } from '@/shared/types'
import { getEventBus } from './plugins/event'
import blockCopyPlugin from './plugins/block-copy'
import imgViewerPlugin from './plugins/img-viewer'
import './style.css'

// CSS prefix
const PREFIX = 'mdr-'

// DOM references
const HTML = document.documentElement
const HEAD = document.head
const BODY = document.body

// Constants
const HEADERS = 'h1, h2, h3, h4, h5, h6'
const CONTENT_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown']
const ROOT_THEME_ATTR = 'data-mdr-theme'
const ROOT_THEME_DISABLED_ATTR = 'data-mdr-theme-disabled'

const darkMQL = window.matchMedia('(prefers-color-scheme: dark)')

// CSS class names
const CN = {
  BODY: `${PREFIX}body`,
  SIDE: `${PREFIX}side`,
  SIDE_ACTIVE: `${PREFIX}side-active`,
  CONTENT: `${PREFIX}content`,
  BTN_WRAP: `${PREFIX}btn-wrap`,
  BTN: `${PREFIX}btn`,
  BTN_CODE_TOGGLE: `${PREFIX}btn-code-toggle`,
  BTN_SIDE_EXPAND: `${PREFIX}btn-side-expand`,
  BTN_GO_TOP: `${PREFIX}btn-go-top`,
  COPY_BTN: 'mdr-copy-btn',
  SIDE_COLLAPSED: `${PREFIX}side-collapsed`,
  SIDE_EXPANDED: `${PREFIX}side-expanded`,
  MODAL: 'mdr-modal',
  ZOOM_IMG: 'mdr-zoom-image',
  HEAD_ANCHOR: `${PREFIX}head-anchor`,
  CENTERED: 'centered',
}

// SVG icons (inline)
const ICONS = {
  code: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  side: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  top: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
}

// --- Plugin registration ---
blockCopyPlugin()
imgViewerPlugin()

const eventBus = getEventBus()

// --- Main ---
async function main(): Promise<void> {
  const rawData = await storage.get()
  const data = getDefaultData(rawData)

  if (!data.enable || !CONTENT_TYPES.includes(document.contentType)) return

  // Init plugins
  initContentPlugins()

  // Set theme
  setTheme(data.pageTheme || 'light')
  BODY.classList.toggle(CN.SIDE_COLLAPSED, !!data.hiddenSide)

  // Get raw content
  const rawPre = BODY.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''

  // Create content area
  const mdContent = document.createElement('article')
  mdContent.className = `${CN.CONTENT} ${data.centered ? CN.CENTERED : ''}`

  const contentRender = (code: string) => {
    const theme = toTheme(data.pageTheme || 'light')
    mdContent.innerHTML = mdRender(code, {
      theme,
      plugins: data.mdPlugins,
    })
  }
  contentRender(mdRaw)

  // Click events for plugins
  mdContent.addEventListener('click', (e) => {
    eventBus.emit('click', e.target, e)
  })

  // Create main body
  const mdBody = document.createElement('main')
  mdBody.className = CN.BODY
  mdBody.appendChild(mdContent)

  // Create sidebar
  const mdSide = createSidebar()
  renderSidebar(mdSide, mdContent)

  // Create buttons
  const btnWrap = createButtons(data)

  // Mount elements
  BODY.appendChild(btnWrap)
  BODY.appendChild(mdBody)
  BODY.appendChild(mdSide)

  // Scroll listener
  let sideHover = false
  let headElements: HTMLElement[] = []
  let sideLiElements: HTMLElement[] = []
  let targetIndex: number | null = null
  let reloading = false

  mdSide.addEventListener('mouseenter', () => { sideHover = true })
  mdSide.addEventListener('mouseleave', () => { sideHover = false })

  document.addEventListener('scroll', throttle(onScroll, 100))

  // Dark mode media query
  darkMQL.addEventListener('change', (e) => {
    if (data.pageTheme === 'auto') {
      rerenderContent(data, mdContent, e.matches ? 'light' : 'dark')
    }
  })

  // Auto refresh
  let pollTimer: number | undefined
  if (data.refresh) {
    pollTimer = startPolling(data, mdRaw, mdContent)
  }

  // Message from background
  chrome.runtime.onMessage.addListener((msg: { action: string; data?: { key: string; value: unknown } }) => {
    const { action, data: msgData } = msg
    if (!msgData) return

    const key = msgData.key as keyof StorageData
    const value = msgData.value

    ;(data as Record<string, unknown>)[key] = value

    switch (action) {
      case 'reload':
        window.location.reload()
        break
      case 'updateMdPlugins': {
        reloading = true
        rerenderContent(data, mdContent)
        renderSidebar(mdSide, mdContent)
        reloading = false
        break
      }
      case 'updatePageTheme': {
        const prevTheme = toTheme(data.pageTheme || 'light')
        setTheme(value as Theme)
        const newTheme = toTheme(value as Theme)
        if (data.mdPlugins?.includes('Mermaid') && prevTheme !== newTheme) {
          rerenderContent(data, mdContent)
        }
        break
      }
      case 'updateCodeTheme':
      case 'updateFontSize':
        rerenderContent(data, mdContent)
        break
      case 'toggleRefresh':
        clearTimeout(pollTimer)
        if (value) pollTimer = startPolling(data, mdRaw, mdContent)
        break
      case 'toggleCentered':
        mdContent.classList.toggle(CN.CENTERED, !!value)
        break
      case 'toggleSide':
        toggleSide(data, mdBody, mdSide)
        break
    }
  })

  function onScroll(): void {
    const scrollTop = document.documentElement.scrollTop
    toggleGoTop(scrollTop >= 640)

    headElements = Array.from(mdContent.querySelectorAll(HEADERS))
    sideLiElements = Array.from(mdSide.querySelectorAll('li'))

    for (let i = 0; i < headElements.length; i++) {
      let sectionTop = -20
      const next = headElements[i + 1]
      if (next) sectionTop += next.offsetTop

      const hit = sectionTop <= 0 || sectionTop > scrollTop
      if (hit && (targetIndex !== i || reloading)) {
        if (targetIndex !== null && sideLiElements[targetIndex]) {
          sideLiElements[targetIndex].classList.remove(CN.SIDE_ACTIVE)
        }
        const target = sideLiElements[i]
        targetIndex = i
        if (target) {
          target.classList.add(CN.SIDE_ACTIVE)
          if (!sideHover) {
            target.scrollIntoView?.({ block: 'nearest' })
          }
        }
      }
      if (hit) break
    }
  }
}

// --- Helpers ---

function toTheme(theme: Theme): Exclude<Theme, 'auto'> {
  return theme === 'auto' ? (darkMQL.matches ? 'dark' : 'light') : theme
}

function setTheme(theme: Theme): void {
  HTML.setAttribute(ROOT_THEME_ATTR, theme)
}

function rerenderContent(data: StorageData, mdContent: HTMLElement, forceTheme?: Theme): void {
  const rawPre = document.body.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''
  mdContent.innerHTML = mdRender(mdRaw, {
    theme: forceTheme || toTheme(data.pageTheme || 'light'),
    plugins: data.mdPlugins,
  })
}

function createSidebar(): HTMLElement {
  const side = document.createElement('ul')
  side.className = CN.SIDE
  return side
}

function renderSidebar(side: HTMLElement, content: HTMLElement): void {
  const idCache: Record<string, number> = Object.create(null)
  side.innerHTML = ''

  const heads = Array.from(content.querySelectorAll(HEADERS))
  for (const head of heads) {
    const text = (head.textContent || '').trim()
    const encoded = encodeId(text, idCache)

    head.setAttribute('id', encoded)

    // Anchor link
    const anchor = document.createElement('a')
    anchor.className = CN.HEAD_ANCHOR
    anchor.href = `#${encoded}`
    anchor.textContent = '#'
    head.insertBefore(anchor, head.firstChild)

    // Sidebar link
    const link = document.createElement('a')
    link.title = text
    link.href = `#${encoded}`
    link.textContent = text

    const li = document.createElement('li')
    li.className = `${CN.SIDE}-${head.tagName.toLowerCase()}`
    li.appendChild(link)
    side.appendChild(li)
  }
}

function encodeId(text: string, cache: Record<string, number>): string {
  const base = text.toLowerCase().replace(/\s+/g, '-')
  const key = encodeURIComponent(base)
  if (!(key in cache)) {
    cache[key] = 1
    return key
  }
  return encodeId(`${base}-${cache[key]++}`, cache)
}

function createButtons(data: StorageData): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = CN.BTN_WRAP

  // Side toggle
  const sideBtn = document.createElement('button')
  sideBtn.className = `${CN.BTN} ${CN.BTN_SIDE_EXPAND}`
  sideBtn.title = 'Toggle sidebar'
  sideBtn.innerHTML = ICONS.side
  sideBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'storage',
      data: { key: 'hiddenSide', value: !data.hiddenSide },
    })
  })

  // Raw toggle
  const rawBtn = document.createElement('button')
  rawBtn.className = `${CN.BTN} ${CN.BTN_CODE_TOGGLE}`
  rawBtn.title = 'Toggle raw'
  rawBtn.innerHTML = ICONS.code
  rawBtn.addEventListener('click', () => {
    const body = document.querySelector(`.${CN.BODY}`)
    const side = document.querySelector(`.${CN.SIDE}`)
    const rawPre = document.querySelector('pre')
    const toggling = HTML.hasAttribute(ROOT_THEME_DISABLED_ATTR)

    BODY.classList.toggle(CN.BODY.replace(/^mdr-/, 'md-reader'))

    if (body) (body as HTMLElement).style.display = toggling ? '' : 'none'
    if (side) (side as HTMLElement).style.display = toggling ? '' : 'none'
    if (rawPre) (rawPre as HTMLElement).style.display = toggling ? 'none' : ''

    if (toggling) {
      HTML.removeAttribute(ROOT_THEME_DISABLED_ATTR)
    } else {
      HTML.setAttribute(ROOT_THEME_DISABLED_ATTR, '')
    }
  })

  // Go top
  const topBtn = document.createElement('button')
  topBtn.className = `${CN.BTN} ${CN.BTN_GO_TOP}`
  topBtn.title = 'Go to top'
  topBtn.innerHTML = ICONS.top
  topBtn.style.display = 'none'
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  wrap.appendChild(sideBtn)
  wrap.appendChild(rawBtn)
  wrap.appendChild(topBtn)

  return wrap
}

function toggleGoTop(show: boolean): void {
  const btn = document.querySelector(`.${CN.BTN_GO_TOP}`) as HTMLElement
  if (btn) btn.style.display = show ? '' : 'none'
}

function toggleSide(data: StorageData, mdBody: HTMLElement, mdSide: HTMLElement): void {
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
    data.hiddenSide = BODY.classList.toggle(CN.SIDE_COLLAPSED)
  }
}

function startPolling(data: StorageData, currentRaw: string | null, mdContent: HTMLElement): number {
  const poll = () => {
    chrome.runtime.sendMessage({ action: 'fetch' }, (res: string) => {
      if (res !== undefined) {
        if (currentRaw === undefined || currentRaw === null) {
          if (res) window.location.reload()
        } else if (currentRaw !== res) {
          currentRaw = res
          mdContent.innerHTML = mdRender(res, {
            theme: toTheme(data.pageTheme || 'light'),
            plugins: data.mdPlugins,
          })
          const rawPre = document.querySelector('pre')
          if (rawPre) rawPre.textContent = res
        }
      }
      setTimeout(poll, 500)
    })
  }
  poll()
  return 0
}

function initContentPlugins(): void {
  // Add head meta tags
  const meta = document.createElement('meta')
  meta.name = 'referrer'
  meta.content = 'no-referrer'
  HEAD.appendChild(meta)

  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.type = 'image/svg+xml'
  favicon.href = chrome.runtime.getURL('assets/logo.png')
  HEAD.appendChild(favicon)

  BODY.classList.add('md-reader')
}

// Start
main()
