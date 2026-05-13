// Default markdown plugin list
export const MD_PLUGINS = [
  'Emoji',
  'Sup',
  'Sub',
  'TOC',
  'Ins',
  'Mark',
  'Katex',
  'Mermaid',
  'Abbr',
  'Deflist',
  'Footnote',
  'TaskLists',
  'Alert',
] as const

export type MdPlugin = (typeof MD_PLUGINS)[number]

export type Theme = 'light' | 'dark' | 'nordic' | 'auto'

export type CodeTheme = 'auto' | 'light' | 'dark'

export type FontSize = 'Extreme Small' | 'Very Small' | 'Small' | 'Medium' | 'Large' | 'Extreme Large'

export const FONT_SIZE_MAP: Record<FontSize, number> = {
  'Extreme Small': 12,
  'Very Small': 14,
  'Small': 16,
  'Medium': 18,
  'Large': 20,
  'Extreme Large': 24,
}

export interface StorageData {
  enable?: boolean
  refresh?: boolean
  centered?: boolean
  hiddenSide?: boolean
  language?: string
  mdPlugins?: MdPlugin[]
  pageTheme?: Theme
  codeTheme?: CodeTheme
  fontSize?: FontSize
  hideDotFiles?: boolean
  sideWidth?: number
  fileTreeRootURL?: string
}

export function getDefaultData(merge: Partial<StorageData> = {}): StorageData {
  return {
    enable: true,
    refresh: false,
    centered: true,
    hiddenSide: false,
    language: 'en',
    mdPlugins: [...MD_PLUGINS],
    pageTheme: 'light',
    codeTheme: 'auto',
    fontSize: 'Small',
    hideDotFiles: false,
    sideWidth: 320,
    fileTreeRootURL: undefined,
    ...merge,
  }
}
