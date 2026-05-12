export interface FileTreeEntry {
  name: string
  url: string
  type: 'directory' | 'file'
}

export function getParentDirectoryURL(fileURL: string): string | null {
  try {
    const url = new URL(fileURL)
    if (url.protocol !== 'file:') return null

    const pathname = url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname
    const lastSlash = pathname.lastIndexOf('/')
    if (lastSlash < 0) return null

    url.pathname = pathname.slice(0, lastSlash + 1)
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

export function normalizeFileURL(fileURL: string): string {
  try {
    const url = new URL(fileURL)
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return fileURL
  }
}

export function isFileInDirectory(fileURL: string, directoryURL: string): boolean {
  try {
    const file = new URL(normalizeFileURL(fileURL))
    const directory = new URL(normalizeFileURL(directoryURL))
    if (file.protocol !== 'file:' || directory.protocol !== 'file:') return false

    const directoryPath = directory.pathname.endsWith('/')
      ? directory.pathname
      : `${directory.pathname}/`
    return file.pathname.startsWith(directoryPath)
  } catch {
    return false
  }
}

export function getFileName(fileURL: string): string {
  try {
    const url = new URL(fileURL)
    const path = decodeURIComponent(url.pathname.replace(/\/$/, ''))
    return path.slice(path.lastIndexOf('/') + 1)
  } catch {
    return fileURL
  }
}

export function parseDirectoryListing(html: string, directoryURL: string): FileTreeEntry[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const currentHref = new URL(directoryURL).href
  const entries = parseAnchorDirectoryListing(doc, currentHref)
  return sortEntries(entries.length ? entries : parseChromeDirectoryListing(html, currentHref))
}

function isMarkdownFile(url: string): boolean {
  return /\.(md|mdx|mdc|mkd|markdown|txt)(?:[?#].*)?$/i.test(url)
}

function parseAnchorDirectoryListing(doc: Document, currentHref: string): FileTreeEntry[] {
  return Array.from(doc.querySelectorAll('a[href]'))
    .map((anchor) => {
      const href = anchor.getAttribute('href')
      if (!href || href === '../') return null

      let url: URL
      try {
        url = new URL(href, currentHref)
      } catch {
        return null
      }

      if (url.protocol !== 'file:' || url.href === currentHref) return null

      const isDirectory = url.pathname.endsWith('/')
      if (!isDirectory && !isMarkdownFile(url.href)) return null

      const text = anchor.textContent?.trim().replace(/\/$/, '')
      const name = text || getFileName(url.href)
      if (!name || name === '..') return null

      return {
        name,
        url: url.href,
        type: isDirectory ? 'directory' : 'file',
      } as FileTreeEntry
    })
    .filter(Boolean) as FileTreeEntry[]
}

function parseChromeDirectoryListing(html: string, currentHref: string): FileTreeEntry[] {
  const rows = html.matchAll(
    /addRow\("((?:\\.|[^"\\])*)",\s*"((?:\\.|[^"\\])*)",\s*(\d)/g,
  )

  return Array.from(rows)
    .map(([, rawName, rawHref, rawType]) => {
      const name = parseJSONString(rawName).replace(/\/$/, '')
      const href = parseJSONString(rawHref)
      if (!name || name === '..' || !href) return null

      let url: URL
      try {
        url = new URL(href, currentHref)
      } catch {
        return null
      }

      const isDirectory = rawType === '1'
      if (url.protocol !== 'file:' || (!isDirectory && !isMarkdownFile(url.href))) {
        return null
      }

      if (isDirectory && !url.pathname.endsWith('/')) {
        url.pathname += '/'
      }

      return {
        name,
        url: url.href,
        type: isDirectory ? 'directory' : 'file',
      } as FileTreeEntry
    })
    .filter(Boolean) as FileTreeEntry[]
}

function parseJSONString(value: string): string {
  try {
    return JSON.parse(`"${value}"`)
  } catch {
    return value
  }
}

function sortEntries(entries: FileTreeEntry[]): FileTreeEntry[] {
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}
