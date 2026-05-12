// Heavy renderer entry — loaded dynamically by the thin content script
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

// DOM refs
const HTML = document.documentElement
const HEAD = document.head
const BODY = document.body

const HEADERS = 'h1, h2, h3, h4, h5, h6'
const ROOT_THEME_ATTR = 'data-mdr-theme'
const ROOT_THEME_DISABLED_ATTR = 'data-mdr-theme-disabled'
const darkMQL = window.matchMedia('(prefers-color-scheme: dark)')

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
  SIDE_COLLAPSED: `${PREFIX}side-collapsed`,
  SIDE_EXPANDED: `${PREFIX}side-expanded`,
  HEAD_ANCHOR: `${PREFIX}head-anchor`,
  CENTERED: 'centered',
}

const ICONS = {
  code: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  side: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  top: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
}

// Register plugins
blockCopyPlugin()
imgViewerPlugin()
const eventBus = getEventBus()

function toTheme(theme: Theme): Exclude<Theme, 'auto'> {
  return theme === 'auto' ? (darkMQL.matches ? 'dark' : 'light') : theme
}

function setTheme(theme: Theme): void {
  HTML.setAttribute(ROOT_THEME_ATTR, theme)
}

function rerender(data: StorageData, mdContent: HTMLElement): void {
  const rawPre = document.body.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''
  mdContent.innerHTML = mdRender(mdRaw, {
    theme: toTheme(data.pageTheme || 'light'),
    plugins: data.mdPlugins,
  })
}

function renderSidebar(side: HTMLElement, content: HTMLElement): void {
  const idCache: Record<string, number> = Object.create(null)
  side.innerHTML = ''
  const heads = Array.from(content.querySelectorAll(HEADERS))
  for (const head of heads) {
    const text = (head.textContent || '').trim()
    const encoded = (function unique(key: string): string {
      if (key in idCache) return unique(`${key}-${idCache[key]++}`)
      idCache[key] = 1
      return key
    })(encodeURIComponent(text.toLowerCase().replace(/\s+/g, '-')))
    head.setAttribute('id', encoded)
    const anchor = document.createElement('a')
    anchor.className = CN.HEAD_ANCHOR
    anchor.href = `#${encoded}`
    anchor.textContent = '#'
    head.insertBefore(anchor, head.firstChild)
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

function createSidebar(): HTMLElement {
  const side = document.createElement('ul')
  side.className = CN.SIDE
  return side
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
  if (!data.enable) return

  setTheme(data.pageTheme || 'light')
  BODY.classList.toggle(CN.SIDE_COLLAPSED, !!data.hiddenSide)

  const rawPre = BODY.querySelector('pre')
  const mdRaw = rawPre?.textContent || ''
  console.log('[md-reader] rawPre:', !!rawPre, 'mdRaw length:', mdRaw.length)

  // Content area
  const mdContent = document.createElement('article')
  mdContent.className = `${CN.CONTENT} ${data.centered ? CN.CENTERED : ''}`
  mdContent.innerHTML = mdRender(mdRaw, {
    theme: toTheme(data.pageTheme || 'light'),
    plugins: data.mdPlugins,
  })

  mdContent.addEventListener('click', (e) => {
    eventBus.emit('click', e.target, e)
  })

  // Main body
  const mdBody = document.createElement('main')
  mdBody.className = CN.BODY
  mdBody.appendChild(mdContent)

  // Sidebar
  const mdSide = createSidebar()
  renderSidebar(mdSide, mdContent)

  // Buttons
  const btnWrap = document.createElement('div')
  btnWrap.className = CN.BTN_WRAP

  const sideBtn = document.createElement('button')
  sideBtn.className = `${CN.BTN} ${CN.BTN_SIDE_EXPAND}`
  sideBtn.title = 'Toggle sidebar'
  sideBtn.innerHTML = ICONS.side
  sideBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'storage', data: { key: 'hiddenSide', value: !data.hiddenSide } })
  })

  const rawBtn = document.createElement('button')
  rawBtn.className = `${CN.BTN} ${CN.BTN_CODE_TOGGLE}`
  rawBtn.title = 'Toggle raw'
  rawBtn.innerHTML = ICONS.code
  rawBtn.addEventListener('click', () => {
    const toggling = HTML.hasAttribute(ROOT_THEME_DISABLED_ATTR)
    BODY.classList.toggle('md-reader')
    mdBody.style.display = toggling ? '' : 'none'
    mdSide.style.display = toggling ? '' : 'none'
    if (rawPre) rawPre.style.display = toggling ? 'none' : ''
    if (toggling) HTML.removeAttribute(ROOT_THEME_DISABLED_ATTR)
    else HTML.setAttribute(ROOT_THEME_DISABLED_ATTR, '')
  })

  const topBtn = document.createElement('button')
  topBtn.className = `${CN.BTN} ${CN.BTN_GO_TOP}`
  topBtn.title = 'Go to top'
  topBtn.innerHTML = ICONS.top
  topBtn.style.display = 'none'
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  btnWrap.appendChild(sideBtn)
  btnWrap.appendChild(rawBtn)
  btnWrap.appendChild(topBtn)

  // Mount
  BODY.appendChild(btnWrap)
  BODY.appendChild(mdBody)
  BODY.appendChild(mdSide)

  // Scroll handler
  let sideHover = false
  let headEls: HTMLElement[] = []
  let sideLis: HTMLElement[] = []
  let targetIdx: number | null = null
  let reloading = false

  mdSide.addEventListener('mouseenter', () => { sideHover = true })
  mdSide.addEventListener('mouseleave', () => { sideHover = false })

  document.addEventListener('scroll', throttle(() => {
    const scrollTop = document.documentElement.scrollTop
    topBtn.style.display = scrollTop >= 640 ? '' : 'none'
    headEls = Array.from(mdContent.querySelectorAll(HEADERS))
    sideLis = Array.from(mdSide.querySelectorAll('li'))

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
      rerender(data, mdContent)
    }
  })

  // Auto refresh
  let pollTimer: number | undefined
  if (data.refresh) {
    let currentRaw = mdRaw
    const poll = () => {
      chrome.runtime.sendMessage({ action: 'fetch' }, (res: string) => {
        if (res !== undefined) {
          if (currentRaw === undefined || currentRaw === null) {
            if (res) window.location.reload()
          } else if (currentRaw !== res) {
            currentRaw = res
            mdContent.innerHTML = mdRender(res, { theme: toTheme(data.pageTheme || 'light'), plugins: data.mdPlugins })
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
      case 'updateMdPlugins': reloading = true; rerender(data, mdContent); renderSidebar(mdSide, mdContent); reloading = false; break
      case 'updatePageTheme': {
        const prev = toTheme(data.pageTheme || 'light')
        setTheme(value as Theme)
        const next = toTheme(value as Theme)
        if (data.mdPlugins?.includes('Mermaid') && prev !== next) rerender(data, mdContent)
        break
      }
      case 'updateCodeTheme':
      case 'updateFontSize': rerender(data, mdContent); break
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
}
