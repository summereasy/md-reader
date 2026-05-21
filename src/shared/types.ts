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
  'CustomCheckbox',
  'Alert',
] as const

export type MdPlugin = (typeof MD_PLUGINS)[number]

export type ColorMode = 'light' | 'dark' | 'auto'
export type LightTheme = 'default' | 'claude' | 'catppuccin-latte' | 'github-light' | 'rose-pine-dawn' | 'everforest-light'
export type DarkTheme = 'default' | 'nordic' | 'catppuccin' | 'tokyo-night' | 'github-dark' | 'everforest'

export const LIGHT_THEMES: { value: LightTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'claude', label: 'Claude' },
  { value: 'catppuccin-latte', label: 'Catppuccin' },
  { value: 'github-light', label: 'GitHub' },
  { value: 'rose-pine-dawn', label: 'Rosé Pine' },
  { value: 'everforest-light', label: 'Everforest' },
]

export const DARK_THEMES: { value: DarkTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'nordic', label: 'Nordic' },
  { value: 'catppuccin', label: 'Catppuccin' },
  { value: 'tokyo-night', label: 'Tokyo Night' },
  { value: 'github-dark', label: 'GitHub' },
  { value: 'everforest', label: 'Everforest' },
]

export type CodeTheme = 'auto' | 'light' | 'dark'

export type FontSize = 'Extreme Small' | 'Very Small' | 'Small' | 'Medium' | 'Large' | 'Very Large' | 'Extreme Large'

export const FONT_SIZE_MAP: Record<FontSize, number> = {
  'Extreme Small': 12,
  'Very Small': 14,
  'Small': 16,
  'Medium': 18,
  'Large': 20,
  'Very Large': 24,
  'Extreme Large': 28,
}

export type ContentWidthMode = 'auto' | 'manual'

export interface StorageData {
  enable?: boolean
  refresh?: boolean
  centered?: boolean
  hiddenSide?: boolean
  language?: string
  mdPlugins?: MdPlugin[]
  colorMode?: ColorMode
  lightTheme?: LightTheme
  darkTheme?: DarkTheme
  codeTheme?: CodeTheme
  fontSize?: FontSize
  hideDotFiles?: boolean
  sideWidth?: number
  fileTreeRootURL?: string
  contentWidthMode?: ContentWidthMode
  contentWidthPercent?: number
}

export function getDefaultData(merge: Partial<StorageData> = {}): StorageData {
  return {
    enable: true,
    refresh: false,
    centered: true,
    hiddenSide: false,
    language: 'en',
    mdPlugins: [...MD_PLUGINS],
    colorMode: 'auto',
    lightTheme: 'default',
    darkTheme: 'default',
    codeTheme: 'auto',
    fontSize: 'Large',
    hideDotFiles: true,
    sideWidth: 320,
    fileTreeRootURL: undefined,
    contentWidthMode: 'auto',
    contentWidthPercent: 100,
    ...merge,
  }
}
