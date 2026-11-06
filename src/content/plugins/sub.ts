/**
 * Subscript plugin (`~text~`), forked from markdown-it-sub.
 *
 * 上游实现只要两个 `~` 之间无空白就当作下标, 会把中文文档里常见的
 * 日期/数字区间误判成下标, 例如 `2026-11-19~20、11-23~24` 中
 * `~20、11-23~` 会被渲染成下标。这里在内容里检测到 CJK 字符、
 * CJK/全角标点或连字符类字符时放弃匹配, 原样输出文本。
 */
import type { PluginSimple } from 'markdown-it'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'

// same as UNESCAPE_MD_RE plus a space
const UNESCAPE_RE = /\\([\\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g

// 连字符类 (含全角长音/连字符)、汉字、CJK 标点与全角形式
const RANGE_LIKE_RE = /[-‐‑‒–—―ー－]|\p{Script=Han}|[\u3000-\u303F\uFF00-\uFFEF]/u

function subscript(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const max = state.posMax

  if (state.src.charCodeAt(start) !== 0x7e /* ~ */) return false
  if (silent) return false // don't run any pairs in validation mode
  if (start + 2 >= max) return false

  state.pos = start + 1

  let found = false
  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === 0x7e /* ~ */) {
      found = true
      break
    }
    state.md.inline.skipToken(state)
  }

  // no closing delimiter or empty content
  if (!found || start + 1 === state.pos) {
    state.pos = start
    return false
  }

  const content = state.src.slice(start + 1, state.pos)

  // don't allow unescaped spaces/newlines inside
  if (/(^|[^\\])(\\\\)*\s/.test(content)) {
    state.pos = start
    return false
  }

  // skip range-like content (dates, CJK number ranges, …)
  if (RANGE_LIKE_RE.test(content)) {
    state.pos = start
    return false
  }

  state.posMax = state.pos
  state.pos = start + 1

  let token = state.push('sub_open', 'sub', 1)
  token.markup = '~'

  token = state.push('text', '', 0)
  token.content = content.replace(UNESCAPE_RE, '$1')

  token = state.push('sub_close', 'sub', -1)
  token.markup = '~'

  state.pos = state.posMax + 1
  state.posMax = max
  return true
}

const subPlugin: PluginSimple = (md) => {
  md.inline.ruler.after('emphasis', 'sub', subscript)
}

export default subPlugin
