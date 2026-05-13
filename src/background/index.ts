// Background Service Worker — self-contained, no chunk imports
// Chrome MV3 service workers don't support cross-chunk ESM imports

// Inline storage (avoid chunk dependency)
const local = chrome.storage.local

async function storageSet(data: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => local.set(data, resolve))
}

async function storageGet(keys?: string | string[] | null): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    local.get(keys as string[] | null, resolve as (items: Record<string, unknown>) => void)
  })
}

async function fetchText(url: string): Promise<string> {
  let lastErr: unknown
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise<void>((r) => setTimeout(r, 300))
    try {
      const res = await fetch(url)
      return await res.text()
    } catch (err) {
      console.warn(`[md-reader] fetch attempt ${i + 1}/3 failed (${url}):`, err)
      lastErr = err
    }
  }
  throw lastErr
}

// Message routing
interface MessagePayload {
  action: string
  data?: { key: string; value: unknown; url?: string }
}

const actionMap: Record<string, string> = {
  enable: 'reload',
  refresh: 'toggleRefresh',
  centered: 'toggleCentered',
  mdPlugins: 'updateMdPlugins',
  colorMode: 'updateColorMode',
  lightTheme: 'updateLightTheme',
  darkTheme: 'updateDarkTheme',
  codeTheme: 'updateCodeTheme',
  fontSize: 'updateFontSize',
  hiddenSide: 'toggleSide',
  hideDotFiles: 'updateFileTreeOptions',
}

function updatePage(key: string, value?: unknown): void {
  const action = actionMap[key]
  if (!action) return
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    if (tabs.length && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { action, data: { key, value } })
    }
  })
}

async function handleMessage(msg: MessagePayload): Promise<unknown> {
  const { action, data } = msg
  switch (action) {
    case 'storage':
      if (data) {
        await storageSet({ [data.key]: data.value })
        updatePage(data.key, data.value)
      }
      return data
    case 'getStorage':
      return storageGet()
    case 'fetch': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = data?.url || tabs.find((t) => t.active)?.url
      if (!url) return 'Error: URL is undefined.'
      try {
        return await fetchText(url)
      } catch (err) {
        console.error(`[md-reader] fetch failed after retries (${url}):`, err)
        return undefined
      }
    }
    case 'readFile': {
      const url = data?.url
      if (!url) return 'Error: URL is undefined.'
      try {
        return await fetchText(url)
      } catch (err) {
        console.error(`[md-reader] readFile failed after retries (${url}):`, err)
        return undefined
      }
    }
    case 'directory': {
      const url = data?.url
      if (!url) return 'Error: URL is undefined.'
      try {
        return await fetchText(url)
      } catch (err) {
        console.error(`[md-reader] directory failed after retries (${url}):`, err)
        return undefined
      }
    }
  }
}

chrome.runtime.onMessage.addListener((msg: MessagePayload, _sender, sendResponse) => {
  handleMessage(msg)
    .then((result) => sendResponse?.(result))
    .catch((err) => sendResponse?.(err.message))
  return true
})

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const handlers: Record<string, () => Promise<void>> = {
    toggleSide: async () => {
      const data = await storageGet('hiddenSide')
      const value = !data.hiddenSide
      await storageSet({ hiddenSide: value })
      updatePage('hiddenSide', value)
    },
    toggleCentered: async () => {
      const data = await storageGet('centered')
      const value = data.centered === undefined ? true : !data.centered
      await storageSet({ centered: value })
      updatePage('centered', value)
    },
    toggleRefresh: async () => {
      const data = await storageGet('refresh')
      const value = !data.refresh
      await storageSet({ refresh: value })
      updatePage('refresh', value)
    },
    togglePageTheme: async () => {
      const data = await storageGet('colorMode')
      const current = (data.colorMode as string) || 'light'
      const value = current === 'light' ? 'dark' : 'light'
      await storageSet({ colorMode: value })
      updatePage('colorMode', value)
    },
  }
  const handler = handlers[command]
  if (handler) await handler()
})
