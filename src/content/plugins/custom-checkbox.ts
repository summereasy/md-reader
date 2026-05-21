/**
 * Custom checkbox plugin for markdown-it.
 *
 * Supports four checkbox states:
 *   [ ]  → unchecked
 *   [x]  → checked (scope: muted/dimmed text)
 *   [-]  → deleted (scope: strikethrough + error color)
 *   [!]  → important (scope: warning color)
 *
 * Renders each as a styled <span> icon instead of native <input>,
 * and wraps the line content in a scope <span> for whole-line styling.
 */
import type MarkdownIt from 'markdown-it'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'
import type Token from 'markdown-it/lib/token.mjs'

export type CheckboxKind = 'unchecked' | 'checked' | 'deleted' | 'important'

const CHECKBOX_MAP: Record<string, CheckboxKind> = {
  '[ ]': 'unchecked',
  '[x]': 'checked',
  '[X]': 'checked',
  '[-]': 'deleted',
  '[!]': 'important',
}

// Lucide SVG inline icons (viewBox 0 0 24 24)
function lucide(inner: string): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
}

export const CHECKBOX_ICONS: Record<CheckboxKind, string> = {
  // Square (unchecked)
  unchecked: lucide('<rect width="18" height="18" x="3" y="3" rx="2"/>'),
  // CircleCheckBig (checked)
  checked: lucide('<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>'),
  // Trash2 (deleted)
  deleted: lucide('<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  // AlertTriangle (important)
  important: lucide('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
}

function attrSet(token: Token, name: string, value: string) {
  const idx = token.attrIndex(name)
  if (idx < 0) {
    token.attrPush([name, value])
  } else {
    token.attrs![idx] = [name, value]
  }
}

function isInline(token: Token) {
  return token.type === 'inline'
}

function isParagraph(token: Token) {
  return token.type === 'paragraph_open'
}

function isListItem(token: Token) {
  return token.type === 'list_item_open'
}

function parentToken(tokens: Token[], index: number): number {
  const targetLevel = tokens[index].level - 1
  for (let i = index - 1; i >= 0; i--) {
    if (tokens[i].level === targetLevel) return i
  }
  return -1
}

function startsWithCheckbox(content: string): CheckboxKind | null {
  for (const [raw, kind] of Object.entries(CHECKBOX_MAP)) {
    if (content.startsWith(raw + ' ') || content === raw) return kind
  }
  return null
}

export default function customCheckboxPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'custom-checkbox', (state: StateCore) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      if (!isInline(tokens[i])) continue
      if (!isParagraph(tokens[i - 1])) continue
      if (!isListItem(tokens[i - 2])) continue

      const inline = tokens[i]
      const kind = startsWithCheckbox(inline.content)
      if (!kind) continue

      // Find the first text child that holds the checkbox marker
      const firstChild = inline.children?.[0]
      if (!firstChild) continue

      const rawLen = kind === 'unchecked' ? 3 : 3 // all are [X]

      // Remove the "[X] " prefix from content
      if (firstChild.type === 'text') {
        firstChild.content = firstChild.content.slice(rawLen + 1) // +1 for trailing space
      }
      inline.content = inline.content.slice(rawLen + 1)

      // Insert checkbox icon token before the remaining content
      const iconToken = new state.Token('html_inline', '', 0)
      iconToken.content = `<span class="mdr-cbx mdr-cbx--${kind}" data-mdr-cbx="${kind}" role="checkbox" aria-checked="${kind === 'unchecked' ? 'false' : 'true'}" tabindex="0">${CHECKBOX_ICONS[kind]}</span>`
      inline.children!.unshift(iconToken)

      // Wrap remaining children in a scope span
      const scopeOpen = new state.Token('html_inline', '', 0)
      scopeOpen.content = `<span class="mdr-cbx-scope mdr-cbx-scope--${kind}">`

      const scopeClose = new state.Token('html_inline', '', 0)
      scopeClose.content = `</span>`

      inline.children!.splice(1, 0, scopeOpen)
      inline.children!.push(scopeClose)

      // Mark the list item
      attrSet(tokens[i - 2], 'class', 'task-list-item')
      const parentIdx = parentToken(tokens, i - 2)
      if (parentIdx >= 0) {
        attrSet(tokens[parentIdx], 'class', 'contains-task-list')
      }
    }
  })
}
