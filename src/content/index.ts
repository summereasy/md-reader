// Thin content script entry — dynamically loads the heavy renderer
const SPLASH_ID = 'md-reader-splash'
const SPLASH_STYLE_ID = 'md-reader-splash-style'

type SplashTheme = 'light' | 'dark'

interface SplashController {
  setTheme: (theme: SplashTheme) => void
  remove: () => void
}

function isMarkdownLikePath(): boolean {
  return /\.(md|mdx|mdc|mkd|txt|markdown)$/i.test(location.pathname)
}

function isRenderableTextPage(): boolean {
  const contentType = document.contentType
  return (
    isMarkdownLikePath() ||
    ['text/plain', 'text/markdown', 'text/x-markdown'].includes(contentType) ||
    contentType.startsWith('text/')
  )
}

function getPreferredSplashTheme(): SplashTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function createSplash(): SplashController | undefined {
  if (!isMarkdownLikePath()) return undefined

  const existing = document.getElementById(SPLASH_ID)
  if (existing && window.__mdReaderSplash) return window.__mdReaderSplash

  const style = document.createElement('style')
  style.id = SPLASH_STYLE_ID
  style.textContent = `
    #${SPLASH_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      background: #ffffff;
      opacity: 1;
      transition: opacity 140ms ease;
    }
    #${SPLASH_ID}[data-theme="dark"] {
      background: #0d1117;
    }
    #${SPLASH_ID}.is-leaving {
      opacity: 0;
    }
    #${SPLASH_ID} .md-reader-splash__mark {
      width: 104px;
      height: 104px;
      background: center / contain no-repeat;
      opacity: 0.92;
      filter: drop-shadow(0 18px 42px rgba(15, 23, 42, 0.12));
    }
    #${SPLASH_ID}[data-theme="dark"] .md-reader-splash__mark {
      opacity: 0.86;
      filter: drop-shadow(0 18px 42px rgba(0, 0, 0, 0.34));
    }
  `

  const splash = document.createElement('div')
  splash.id = SPLASH_ID
  splash.dataset.theme = getPreferredSplashTheme()

  const mark = document.createElement('div')
  mark.className = 'md-reader-splash__mark'
  mark.style.backgroundImage = `url("${chrome.runtime.getURL('assets/logo-stroke.png')}")`
  splash.appendChild(mark)

  document.documentElement.append(style, splash)

  const controller: SplashController = {
    setTheme(theme) {
      splash.dataset.theme = theme
    },
    remove() {
      splash.classList.add('is-leaving')
      window.setTimeout(() => {
        splash.remove()
        style.remove()
        if (window.__mdReaderSplash === controller) delete window.__mdReaderSplash
      }, 160)
    },
  }
  window.__mdReaderSplash = controller
  return controller
}

const splash = createSplash()

;(function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
    return
  }

  if (!isRenderableTextPage()) {
    splash?.remove()
    return
  }

  const rendererUrl = chrome.runtime.getURL('assets/md-renderer.js')
  import(rendererUrl)
    .then(() => {
      if (typeof window.__mdReaderInit === 'function') {
        window.__mdReaderInit()
      } else {
        console.error('[md-reader] renderer loaded but __mdReaderInit not found')
        splash?.remove()
      }
    })
    .catch((err) => {
      console.error('[md-reader] Failed to load renderer:', err)
      splash?.remove()
    })
})()
