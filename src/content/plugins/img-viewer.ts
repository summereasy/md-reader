import debounce from 'lodash.debounce'
import { createPluginCtx } from './event'

interface Position {
  width: number
  height: number
  x: number
  y: number
  rate?: number
}

let sourceImg: HTMLImageElement | null = null
let modalEl: HTMLElement | null = null
let clonedImg: HTMLImageElement | null = null
let setPositionFn: ((pos: Position) => void) | null = null

const debounceResize = debounce(() => {
  if (sourceImg) {
    setPositionFn?.(calcLastPosition(sourceImg.naturalWidth, sourceImg.naturalHeight))
  }
}, 100)

function setElePosition(el: HTMLImageElement, pos: Position): void {
  Object.assign(el.style, {
    width: `${pos.width}px`,
    height: `${pos.height}px`,
    transform: `translate(${pos.x}px, ${pos.y}px)`,
  })
}

function calcFirstPosition(el: HTMLImageElement, container: HTMLElement): Position {
  return {
    width: el.offsetWidth,
    height: el.offsetHeight,
    x: el.offsetLeft - container.scrollLeft,
    y: el.offsetTop - container.scrollTop,
  }
}

function calcLastPosition(w: number, h: number): Position {
  const rate = w / h
  const sw = window.innerWidth
  const sh = window.innerHeight

  let lw = w
  let lh = h
  if (lw > sw || lh > sh) {
    lw = sw
    lh = lw / rate
    if (lh > sh) {
      lh = sh
      lw = lh * rate
    }
  }
  return {
    width: lw,
    height: lh,
    x: (sw - lw) / 2,
    y: (sh - lh) / 2,
    rate,
  }
}

export function openImageViewer(el: HTMLImageElement): void {
  sourceImg = el

  // Init modal
  if (!modalEl) {
    modalEl = document.createElement('div')
    modalEl.className = 'md-reader__modal'
    modalEl.style.display = 'none'
    modalEl.addEventListener('click', closeModal)
    document.body.appendChild(modalEl)
  }

  // Init cloned image
  if (!clonedImg) {
    clonedImg = document.createElement('img')
    clonedImg.className = 'md-reader__zoom-image'
    clonedImg.style.display = 'none'
    setPositionFn = (pos) => setElePosition(clonedImg!, pos)
    modalEl.appendChild(clonedImg)
  }

  // Set first position
  const container = document.documentElement
  const firstPos = calcFirstPosition(el, container)
  setElePosition(clonedImg, firstPos)
  clonedImg.src = el.src
  clonedImg.style.display = ''

  // Show modal
  modalEl.style.display = ''

  // Animate to final position
  requestAnimationFrame(() => {
    const lastPos = calcLastPosition(el.naturalWidth, el.naturalHeight)
    setElePosition(clonedImg!, lastPos)
    el.style.visibility = 'hidden'
    modalEl!.classList.add('opened')
  })

  window.addEventListener('resize', debounceResize)
}

function closeModal(e?: Event): void {
  if (!modalEl?.classList.contains('opened')) return

  modalEl.addEventListener(
    'transitionend',
    () => {
      if (sourceImg) sourceImg.style.visibility = ''
      modalEl!.style.display = 'none'
      if (clonedImg) {
        clonedImg.style.display = 'none'
        clonedImg.src = ''
      }
    },
    { once: true },
  )

  const firstPos = calcFirstPosition(sourceImg!, document.documentElement)
  setPositionFn?.(firstPos)
  modalEl.classList.remove('opened')
  window.removeEventListener('resize', debounceResize)

  e?.stopPropagation()
  e?.preventDefault()
}

// Register plugin
export default function imgViewerPlugin(): void {
  const ctx = createPluginCtx()
  ctx.on('click', (target: HTMLElement) => {
    if (target.tagName.toLowerCase() === 'img') {
      // Skip if inside <a> tag
      let parent = target.parentElement
      while (parent) {
        if (parent.tagName === 'A') return
        parent = parent.parentElement
      }
      openImageViewer(target as HTMLImageElement)
    }
  })
}
