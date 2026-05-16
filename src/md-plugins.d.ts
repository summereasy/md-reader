// Type declarations for markdown-it plugins without @types packages
declare module 'markdown-it-sub' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-sup' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-ins' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-abbr' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-mark' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-emoji' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-deflist' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions<{ enabled?: boolean; label?: boolean; labelAfter?: boolean }>
  export default plugin
}

declare module 'markdown-it-table-of-contents' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions
  export default plugin
}

declare module 'markdown-it-container' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions
  export default plugin
}

declare module '@md-reader/markdown-it-mermaid' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions
  export default plugin
}

declare module 'mermaid' {
  const mermaid: {
    initialize(config: any): void
    mermaidAPI: {
      render(id: string, code: string, callback?: (svg: string) => void): { svg: string }
    }
  }
  export default mermaid
}

declare module 'markdown-it-multimd-table' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions
  export default plugin
}

declare module '@mdit/plugin-alert' {
  import type { PluginWithOptions } from 'markdown-it'
  export const alert: PluginWithOptions
}
