import type MarkdownIt from 'markdown-it'

// Local type for markdown-it Token (from markdown-it/lib/token)
interface Token {
  type: string
  tag: string
  attrs: Array<[string, string]> | null
  map: [number, number] | null
  nesting: number
  level: number
  children: Token[] | null
  content: string
  markup: string
  info: string
  meta: unknown
  block: boolean
  hidden: boolean
}

import mContainer from 'markdown-it-container'
import { alert } from '@mdit/plugin-alert'

export default function AlertPlugin(md: MarkdownIt) {
  // @mdit/plugin-alert
  md.use(alert, { deep: true } as never)

  // Custom containers
  const containers: Array<[typeof mContainer, string, { render: (tokens: Token[], idx: number) => string }]> = [
    [mContainer, 'note', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="info">\n' : '</blockquote>\n',
    }],
    [mContainer, 'info', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="info">\n' : '</blockquote>\n',
    }],
    [mContainer, 'tips', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="tip">\n' : '</blockquote>\n',
    }],
    [mContainer, 'tip', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="tip">\n' : '</blockquote>\n',
    }],
    [mContainer, 'success', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="success">\n' : '</blockquote>\n',
    }],
    [mContainer, 'warning', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="warning">\n' : '</blockquote>\n',
    }],
    [mContainer, 'danger', {
      render: (tokens: Token[], idx: number) =>
        tokens[idx].nesting === 1 ? '<blockquote class="danger">\n' : '</blockquote>\n',
    }],
  ]

  for (const [plugin, name, opts] of containers) {
    md.use(plugin, name, opts)
  }
}
