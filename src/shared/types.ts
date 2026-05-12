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

export type Theme = 'light' | 'dark' | 'auto'

export type CodeTheme = 'auto' | 'light' | 'dark'

export type FontSize = 'Tiny' | 'Small' | 'Normal' | 'Medium' | 'Large' | 'Extra Large'

export const FONT_SIZE_MAP: Record<FontSize, number> = {
  Tiny: 12,
  Small: 14,
  Normal: 16,
  Medium: 18,
  Large: 20,
  'Extra Large': 24,
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
    fontSize: 'Normal',
    hideDotFiles: false,
    sideWidth: 260,
    ...merge,
  }
}
