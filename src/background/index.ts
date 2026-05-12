import { storage } from '@/shared/storage'

interface MessagePayload {
  action: string
  data?: { key: string; value: unknown }
}

// Storage change → update current page
const actionMap: Record<string, string> = {
  enable: 'reload',
  refresh: 'toggleRefresh',
  centered: 'toggleCentered',
  mdPlugins: 'updateMdPlugins',
  pageTheme: 'updatePageTheme',
  codeTheme: 'updateCodeTheme',
  fontSize: 'updateFontSize',
  hiddenSide: 'toggleSide',
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

// Message handler
chrome.runtime.onMessage.addListener((msg: MessagePayload, _sender, sendResponse) => {
  handleMessage(msg)
    .then((result) => sendResponse?.(result))
    .catch((err) => sendResponse?.(err.message))
  return true
})

async function handleMessage(msg: MessagePayload): Promise<unknown> {
  const { action, data } = msg

  switch (action) {
    case 'storage':
      if (data) {
        // set() accepts string keys with value, or partial object
        await (storage.set as (key: string, value: unknown) => Promise<void>)(data.key, data.value)
        updatePage(data.key, data.value)
      }
      return data

    case 'getStorage':
      return storage.get()

    case 'fetch': {
      const senderUrl = (await chrome.tabs.query({ active: true, currentWindow: true }))
        .find((t) => t.active)?.url
      if (!senderUrl) return 'Error: URL is undefined.'
      try {
        const res = await fetch(senderUrl)
        return res.text()
      } catch (err) {
        console.error(err)
        return (err as Error).message
      }
    }
  }
}

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const commands: Record<string, () => Promise<void>> = {
    toggleSide: async () => {
      const { hiddenSide } = await storage.get('hiddenSide')
      await storage.set('hiddenSide', !hiddenSide)
      updatePage('hiddenSide', !hiddenSide)
    },
    toggleCentered: async () => {
      const { centered } = await storage.get('centered')
      const value = centered === undefined ? true : !centered
      await storage.set('centered', value)
      updatePage('centered', value)
    },
    toggleRefresh: async () => {
      const { refresh } = await storage.get('refresh')
      const value = !refresh
      await storage.set('refresh', value)
      updatePage('refresh', value)
    },
    togglePageTheme: async () => {
      const { pageTheme = 'light' } = await storage.get('pageTheme')
      const value = pageTheme === 'light' ? 'dark' : 'light'
      await storage.set('pageTheme', value)
      updatePage('pageTheme', value)
    },
  }

  const handler = commands[command]
  if (handler) {
    await handler()
  }
})

// Uninstall URL
chrome.runtime.setUninstallURL('https://github.com/summereasy/md-reader/discussions')
