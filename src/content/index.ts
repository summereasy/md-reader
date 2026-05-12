// Thin content script entry — dynamically loads the heavy renderer
(function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
    return
  }

  // Check if we should render this page
  const ct = document.contentType
  const isMd = /\.(md|mdx|mdc|mkd|txt|markdown)$/i.test(location.pathname)
  const isText = ['text/plain', 'text/markdown', 'text/x-markdown'].includes(ct)
  if (!isText && !isMd && !ct.startsWith('text/')) return

  const rendererUrl = chrome.runtime.getURL('assets/md-renderer.js')
  import(rendererUrl)
    .then((mod) => mod.initContentScript())
    .catch((err) => console.error('[md-reader] Failed to load renderer:', err))
})()
