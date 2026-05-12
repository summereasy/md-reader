import { createPluginCtx } from './event'

async function writeText(text: string): Promise<void> {
  if ('clipboard' in navigator) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback
  const pre = document.createElement('pre')
  pre.style.cssText = 'width:1px;height:1px;overflow:hidden;position:fixed;top:0'
  pre.textContent = text
  document.body.appendChild(pre)
  const sel = getSelection()!
  sel.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(pre)
  sel.addRange(range)
  document.execCommand('copy')
  sel.removeAllRanges()
  document.body.removeChild(pre)
}

export default function blockCopyPlugin(): void {
  const ctx = createPluginCtx()
  ctx.on('click', async (target: HTMLElement) => {
    if (target.classList.contains('md-reader__btn--copy') || target.closest('.md-reader__btn--copy')) {
      const btn = target.closest('.md-reader__btn--copy') as HTMLElement
      if (btn.classList.contains('copied')) return

      const codeEl = btn.parentElement?.querySelector('code.hljs') as HTMLElement
      if (codeEl) {
        await writeText(codeEl.textContent || '')
        btn.classList.add('copied')
        setTimeout(() => btn.classList.remove('copied'), 1500)
      }
    }
  })
}
