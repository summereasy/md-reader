// Thin content script entry — dynamically loads the heavy renderer
(async function main() {
  const CONTENT_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown']
  if (!CONTENT_TYPES.includes(document.contentType)) return

  try {
    // Dynamic import the renderer (mermaid + katex + highlight.js are heavy)
    const rendererUrl = chrome.runtime.getURL('assets/md-renderer.js')
    const { initContentScript } = await import(rendererUrl)
    initContentScript()
  } catch (err) {
    console.error('[md-reader] Failed to load renderer:', err)
  }
})()
