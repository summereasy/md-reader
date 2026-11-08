import styleCss from './style.css?raw'
import { FONT_SIZE_MAP } from '@/shared/types'
import type { StorageData, LightTheme, DarkTheme, FontSize } from '@/shared/types'

const KATEX_VERSION = '0.16.45'

export type ExportTheme =
  | 'light' | 'dark' | 'nordic' | 'claude' | 'catppuccin' | 'tokyo-night' | 'github-dark' | 'everforest'
  | 'catppuccin-latte' | 'github-light' | 'rose-pine-dawn' | 'everforest-light'

function themeFromLight(theme: LightTheme): ExportTheme {
  return theme === 'default' ? 'light' : theme
}

function themeFromDark(theme: DarkTheme): ExportTheme {
  return theme === 'default' ? 'dark' : theme
}

function resolveCurrentTheme(data: StorageData): ExportTheme {
  const mode = data.colorMode ?? 'light'
  const isDark = mode === 'auto'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : mode === 'dark'
  return isDark ? themeFromDark(data.darkTheme ?? 'default') : themeFromLight(data.lightTheme ?? 'default')
}

function extractThemeVariables(css: string): string {
  const start = css.indexOf(':root {')
  const end = css.indexOf('\n\nbody.md-reader {')
  if (start === -1 || end === -1) return ''
  return css.slice(start, end).trim()
}

function extractExportSections(css: string): string {
  const startMarker = '/* @mdr-export:start */'
  const endMarker = '/* @mdr-export:end */'
  const sections: string[] = []
  let searchFrom = 0

  while (searchFrom < css.length) {
    const start = css.indexOf(startMarker, searchFrom)
    if (start === -1) break
    const end = css.indexOf(endMarker, start + startMarker.length)
    if (end === -1) break
    sections.push(css.slice(start + startMarker.length, end).trim())
    searchFrom = end + endMarker.length
  }

  return sections.join('\n\n')
}

function transformContentCss(css: string): string {
  return css.replace(/\.md-reader__markdown-content/g, '.md-content')
}

function buildLayoutCss(fontSize: number): string {
  return `
html {
  color-scheme: light dark;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--mdr-bg);
  color: var(--mdr-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  line-height: 1.6;
  counter-reset: katexEqnNo mmlEqnNo;
}

.md-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 48px 48px;
  color: var(--mdr-text);
  font-size: ${fontSize}px;
  word-break: break-word;
  overflow-x: hidden;
}

.md-content img {
  cursor: zoom-in;
}

/* Image lightbox */
#mdr-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.92);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0s linear 0.2s;
  touch-action: none;
  overscroll-behavior: contain;
}

#mdr-lightbox.opened {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 0.2s ease, visibility 0s linear 0s;
}

html.mdr-lightbox-open,
html.mdr-lightbox-open body {
  overflow: hidden;
}

html.mdr-lightbox-open #mdr-theme-toggle {
  opacity: 0;
  pointer-events: none;
}

#mdr-lightbox-img {
  display: block;
  max-width: 100vw;
  max-height: 100vh;
  transform-origin: center center;
  will-change: transform;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
}

#mdr-lightbox-close {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top, 0px));
  right: calc(16px + env(safe-area-inset-right, 0px));
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  background: rgba(24, 24, 24, 0.72);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.15s, transform 0.15s;
}

#mdr-lightbox-close:hover {
  background: rgba(64, 64, 64, 0.85);
}

#mdr-lightbox-close:active {
  transform: scale(0.94);
}

#mdr-lightbox-close:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

#mdr-theme-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--mdr-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--mdr-bg) 88%, transparent);
  color: var(--mdr-text-secondary);
  box-shadow: 0 8px 24px var(--mdr-elevated-shadow-soft);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

#mdr-theme-toggle:hover {
  color: var(--mdr-link);
  background: var(--mdr-hover-bg-strong);
}

#mdr-theme-toggle:active {
  transform: scale(0.96);
}

#mdr-theme-toggle svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

@media (max-width: 640px) {
  .md-content {
    padding: 20px 16px 36px;
  }

  #mdr-theme-toggle {
    right: 12px;
    bottom: 12px;
    width: 40px;
    height: 40px;
  }

  #mdr-lightbox-close {
    top: calc(12px + env(safe-area-inset-top, 0px));
    right: calc(12px + env(safe-area-inset-right, 0px));
  }
}

@media (min-width: 1660px) {
  .md-content {
    max-width: 1120px;
  }
}

@media (min-width: 2048px) {
  .md-content {
    max-width: 1280px;
  }
}

@media print {
  #mdr-theme-toggle,
  #mdr-lightbox {
    display: none !important;
  }

  html,
  body,
  .md-content {
    background: #fff !important;
    color: #1a1a1a !important;
  }

  .md-content,
  .md-content p:not(.markdown-alert-title),
  .md-content li,
  .md-content td,
  .md-content th {
    color: #1a1a1a !important;
  }

  .md-content h1,
  .md-content h2,
  .md-content h3,
  .md-content h4,
  .md-content h5,
  .md-content h6 {
    color: #111 !important;
  }

  .md-content blockquote:not(.info):not(.tip):not(.tips):not(.success):not(.warning):not(.danger),
  .md-content blockquote:not(.info):not(.tip):not(.tips):not(.success):not(.warning):not(.danger) p {
    color: #333 !important;
    border-left-color: #666 !important;
    background: transparent !important;
  }

  .md-content a {
    color: #1a1a1a !important;
    text-decoration: underline;
  }

  .md-content pre,
  .md-content pre code,
  .md-content code {
    background: #f5f5f5 !important;
    color: #1a1a1a !important;
  }

  .md-content hr {
    border-top-color: #ccc !important;
  }

  .md-content img,
  .md-content .mermaid svg {
    max-width: 100% !important;
    break-inside: avoid;
  }
}
`.trim()
}

let cachedExportCss: string | null = null

function getExportCss(fontSize: number): string {
  const layout = buildLayoutCss(fontSize)
  if (cachedExportCss) return `${cachedExportCss}\n${layout}`
  const themeCss = extractThemeVariables(styleCss)
  const contentCss = transformContentCss(extractExportSections(styleCss))
  cachedExportCss = `${themeCss}\n${contentCss}`
  return `${cachedExportCss}\n${layout}`
}

function cleanContent(root: HTMLElement): void {
  root.className = 'md-content'
  root.removeAttribute('hidden')
  root.querySelectorAll('.md-reader__btn--copy').forEach((el) => el.remove())
  root.querySelectorAll('.md-reader__head-anchor').forEach((el) => el.remove())
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/\.(md|mdx|mdc|mkd|markdown|txt)$/i, '')
  const safe = base.replace(/[^\w\u4e00-\u9fff.-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'document'
}

const SUN_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
const MOON_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`

/**
 * 导出 HTML 内的图片查看器: 点击图片全屏查看, 支持双指缩放 / 滚轮缩放 /
 * 双击缩放 / 拖动平移, 用右上角关闭按钮、点击背景或 Esc 返回正文.
 */
const LIGHTBOX_SCRIPT = `(function () {
  var root = document.documentElement;

  // 提前创建看图器并挂上事件委托: 导出文件可能很大 (大量内嵌图片),
  // 用户往往在正文仍在解析/加载时就开始看图片, 不能等到文件末尾脚本执行后才有交互.
  var box = document.createElement('div');
  box.id = 'mdr-lightbox';
  box.setAttribute('aria-hidden', 'true');
  var view = document.createElement('img');
  view.id = 'mdr-lightbox-img';
  view.alt = '';
  var closeBtn = document.createElement('button');
  closeBtn.id = 'mdr-lightbox-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭图片预览');
  closeBtn.innerHTML = '&times;';
  box.appendChild(view);
  box.appendChild(closeBtn);
  document.body.appendChild(box);

  var MAX_SCALE = 8;
  var DOUBLE_SCALE = 2.5;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  var pointers = new Map();
  var drag = null;
  var pinch = null;
  var lastTapAt = 0;
  var lastTapX = 0;
  var lastTapY = 0;
  var suppressClickUntil = 0;
  var lastTrigger = null;

  function render() {
    view.style.transform = 'translate3d(' + tx + 'px, ' + ty + 'px, 0) scale(' + scale + ')';
  }

  function boxCenter() {
    var rect = box.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function clampPan() {
    var w = view.offsetWidth * scale;
    var h = view.offsetHeight * scale;
    var maxX = Math.max(0, (w - box.clientWidth) / 2 + 24);
    var maxY = Math.max(0, (h - box.clientHeight) / 2 + 24);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function zoomTo(target, cx, cy) {
    target = Math.min(MAX_SCALE, Math.max(1, target));
    if (target <= 1.001) {
      scale = 1;
      tx = 0;
      ty = 0;
      render();
      return;
    }
    var center = boxCenter();
    var px = cx - center.x;
    var py = cy - center.y;
    var ratio = target / scale;
    tx = px - ratio * (px - tx);
    ty = py - ratio * (py - ty);
    scale = target;
    clampPan();
    render();
  }

  function resetView() {
    scale = 1;
    tx = 0;
    ty = 0;
    render();
  }

  // 让图片先适配视口: 小图适度放大 (最多 4x), 大图缩小, 保证点开后是"全屏看图"而不是原尺寸.
  function fitImage() {
    var natW = view.naturalWidth;
    var natH = view.naturalHeight;
    if (!natW || !natH) return false;
    var availW = box.clientWidth || window.innerWidth;
    var availH = box.clientHeight || window.innerHeight;
    var fit = Math.min(availW / natW, availH / natH, 4);
    view.style.width = Math.floor(natW * fit) + 'px';
    view.style.height = Math.floor(natH * fit) + 'px';
    return true;
  }

  function scheduleFit() {
    if (fitImage()) return;
    setTimeout(function () {
      if (box.classList.contains('opened') && fitImage()) {
        clampPan();
        render();
      }
    }, 150);
  }

  function refit() {
    if (!box.classList.contains('opened')) return;
    if (!fitImage()) return;
    clampPan();
    render();
  }

  function openViewer(src, alt, trigger) {
    lastTrigger = trigger || null;
    view.setAttribute('src', src);
    view.setAttribute('alt', alt || '');
    view.style.width = 'auto';
    view.style.height = 'auto';
    resetView();
    box.classList.add('opened');
    box.setAttribute('aria-hidden', 'false');
    root.classList.add('mdr-lightbox-open');
    scheduleFit();
    try {
      closeBtn.focus({ preventScroll: true });
    } catch (error) {
      closeBtn.focus();
    }
  }

  function closeViewer() {
    if (!box.classList.contains('opened')) return;
    box.classList.remove('opened');
    box.setAttribute('aria-hidden', 'true');
    root.classList.remove('mdr-lightbox-open');
    pointers.clear();
    drag = null;
    pinch = null;
    if (lastTrigger && lastTrigger.focus) {
      if (lastTrigger.tagName === 'IMG' && !lastTrigger.hasAttribute('tabindex')) {
        lastTrigger.setAttribute('tabindex', '-1');
      }
      try {
        lastTrigger.focus({ preventScroll: true });
      } catch (error) {
        lastTrigger.focus();
      }
    }
    lastTrigger = null;
  }

  function distance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || target.tagName !== 'IMG') return;
    if (!target.closest || !target.closest('.md-content')) return;
    if (target.closest('a')) return;
    var src = target.currentSrc || target.src;
    if (!src) return;
    event.preventDefault();
    openViewer(src, target.getAttribute('alt'), target);
  });

  view.addEventListener('load', refit);
  window.addEventListener('resize', refit);

  closeBtn.addEventListener('click', closeViewer);

  box.addEventListener('click', function (event) {
    if (event.target !== box) return;
    if (performance.now() < suppressClickUntil) return;
    closeViewer();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeViewer();
  });

  box.addEventListener('wheel', function (event) {
    if (!box.classList.contains('opened')) return;
    event.preventDefault();
    zoomTo(scale * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
  }, { passive: false });

  box.addEventListener('dblclick', function (event) {
    if (!box.classList.contains('opened')) return;
    event.preventDefault();
    zoomTo(scale > 1.01 ? 1 : DOUBLE_SCALE, event.clientX, event.clientY);
  });

  box.addEventListener('dragstart', function (event) {
    event.preventDefault();
  });

  box.addEventListener('pointerdown', function (event) {
    if (!box.classList.contains('opened')) return;
    if (event.target === closeBtn) return;
    if (event.target === view) event.preventDefault();
    try {
      box.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointer capture is optional */
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        tx: tx,
        ty: ty,
        moved: false,
        at: event.timeStamp,
      };
      pinch = null;
    } else if (pointers.size === 2) {
      var list = Array.from(pointers.values());
      pinch = {
        distance: distance(list[0], list[1]),
        mid: midpoint(list[0], list[1]),
        scale: scale,
        tx: tx,
        ty: ty,
      };
      drag = null;
    }
  });

  box.addEventListener('pointermove', function (event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2 && pinch) {
      var list = Array.from(pointers.values());
      var nextScale = Math.min(MAX_SCALE, Math.max(1, pinch.scale * (distance(list[0], list[1]) / pinch.distance)));
      var mid = midpoint(list[0], list[1]);
      if (nextScale <= 1.001) {
        scale = 1;
        tx = 0;
        ty = 0;
      } else {
        var center = boxCenter();
        var ratio = nextScale / pinch.scale;
        var px = pinch.mid.x - center.x;
        var py = pinch.mid.y - center.y;
        tx = (px - ratio * (px - pinch.tx)) + (mid.x - pinch.mid.x);
        ty = (py - ratio * (py - pinch.ty)) + (mid.y - pinch.mid.y);
        scale = nextScale;
        clampPan();
      }
      suppressClickUntil = performance.now() + 400;
      render();
      return;
    }

    if (!drag || drag.id !== event.pointerId) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
      suppressClickUntil = performance.now() + 400;
    }
    if (scale > 1.001) {
      tx = drag.tx + dx;
      ty = drag.ty + dy;
      clampPan();
      render();
    }
  });

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    var wasDrag = drag && drag.id === event.pointerId ? drag : null;
    pointers.delete(event.pointerId);

    if (pointers.size === 1) {
      var remaining = Array.from(pointers.entries())[0];
      if (remaining) {
        drag = {
          id: remaining[0],
          x: remaining[1].x,
          y: remaining[1].y,
          tx: tx,
          ty: ty,
          moved: false,
          at: event.timeStamp,
        };
      }
      pinch = null;
      return;
    }
    if (pointers.size > 1) return;

    drag = null;
    pinch = null;
    if (!wasDrag || wasDrag.moved) return;

    if (event.pointerType === 'mouse') return;
    if (event.target !== view) return;

    var now = event.timeStamp;
    var isDoubleTap = now - lastTapAt < 320
      && Math.abs(event.clientX - lastTapX) < 32
      && Math.abs(event.clientY - lastTapY) < 32;
    if (isDoubleTap) {
      zoomTo(scale > 1.01 ? 1 : DOUBLE_SCALE, event.clientX, event.clientY);
      lastTapAt = 0;
    } else {
      lastTapAt = now;
      lastTapX = event.clientX;
      lastTapY = event.clientY;
    }
  }

  box.addEventListener('pointerup', endPointer);
  box.addEventListener('pointercancel', endPointer);

  box.addEventListener('contextmenu', function (event) {
    if (box.classList.contains('opened')) event.preventDefault();
  });
})();`

function buildHtmlDocument(options: {
  bodyHtml: string
  title: string
  lightTheme: ExportTheme
  darkTheme: ExportTheme
  initialTheme: ExportTheme
  css: string
}): string {
  const { bodyHtml, title, lightTheme, darkTheme, initialTheme, css } = options
  const safeTitle = escapeHtml(title)

  return `<!DOCTYPE html>
<html lang="zh-CN" data-mdr-theme="${initialTheme}" data-mdr-light="${lightTheme}" data-mdr-dark="${darkTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" crossorigin="anonymous">
  <style>${css}</style>
</head>
<body>
  <script>${LIGHTBOX_SCRIPT}</script>
  <article class="md-content">${bodyHtml}</article>
  <button id="mdr-theme-toggle" type="button" aria-label="切换主题">${MOON_ICON}</button>
  <script>
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('mdr-theme-toggle');
  var light = root.dataset.mdrLight;
  var dark = root.dataset.mdrDark;
  var sun = ${JSON.stringify(SUN_ICON)};
  var moon = ${JSON.stringify(MOON_ICON)};

  function syncIcon() {
    var current = root.getAttribute('data-mdr-theme');
    btn.innerHTML = current === dark ? sun : moon;
    btn.setAttribute('aria-label', current === dark ? '切换到浅色' : '切换到深色');
  }

  btn.addEventListener('click', function () {
    var current = root.getAttribute('data-mdr-theme');
    root.setAttribute('data-mdr-theme', current === dark ? light : dark);
    syncIcon();
  });

  syncIcon();
})();
  </script>
</body>
</html>`
}

function downloadBlob(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function fetchImageDataUrl(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { action: 'fetchDataUrl', data: { url } },
        (res: unknown) => {
          if (chrome.runtime.lastError || typeof res !== 'string' || !res.startsWith('data:')) {
            resolve(undefined)
          } else {
            resolve(res)
          }
        },
      )
    } catch {
      resolve(undefined)
    }
  })
}

/**
 * 内嵌图片前先压缩: 导出的 HTML 里常有很多本地截图,
 * 原图 (例如 3816px 宽的 PPT 截图) 直接 base64 会让单文件膨胀到几十 MB.
 * 这里把大图缩到最长边 1600px 并重新编码为 JPEG, 正文显示宽度只有 980px 左右,
 * 视觉损失可以忽略, 体积通常能降到原来的 1/5 以下.
 */
const EXPORT_IMAGE_MAX_SIDE = 1600
const EXPORT_IMAGE_QUALITY = 0.82
const EXPORT_IMAGE_MIN_BYTES = 200 * 1024

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = dataUrl
  })
}

async function optimizeImageDataUrl(dataUrl: string): Promise<string> {
  if (!/^data:image\/(jpeg|jpg|png|webp|bmp)/i.test(dataUrl)) return dataUrl

  const originalBytes = dataUrlByteLength(dataUrl)
  const image = await loadDataUrlImage(dataUrl)
  if (!image) return dataUrl

  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!width || !height) return dataUrl

  const scale = Math.min(1, EXPORT_IMAGE_MAX_SIDE / Math.max(width, height))
  if (scale >= 1 && originalBytes < EXPORT_IMAGE_MIN_BYTES) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  // 统一铺白底, 避免 PNG 透明区域转 JPEG 后发黑
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  for (const quality of [EXPORT_IMAGE_QUALITY, 0.72]) {
    const optimized = canvas.toDataURL('image/jpeg', quality)
    if (dataUrlByteLength(optimized) < originalBytes) return optimized
  }
  return dataUrl
}

/**
 * 将 file: 协议的本地图片内联为 base64 data URI，
 * 否则导出的 HTML 换个目录后相对路径全部失效。
 * 读取失败时保留原 src，远程 (http/https) 图片保持原样。
 */
async function inlineLocalImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'))
  const cache = new Map<string, string | undefined>()

  await Promise.all(
    imgs.map(async (img) => {
      const raw = img.getAttribute('src')
      if (!raw) return

      let abs: string
      try {
        abs = new URL(raw, location.href).href
      } catch {
        return
      }
      if (!abs.startsWith('file:')) return

      if (!cache.has(abs)) {
        const dataUrl = await fetchImageDataUrl(abs)
        cache.set(abs, dataUrl ? await optimizeImageDataUrl(dataUrl) : undefined)
      }
      const dataUrl = cache.get(abs)
      if (dataUrl) img.setAttribute('src', dataUrl)
    }),
  )
}

export async function exportMarkdownHtml(options: {
  content: HTMLElement
  data: StorageData
  filename: string
}): Promise<void> {
  const lightTheme = themeFromLight(options.data.lightTheme ?? 'default')
  const darkTheme = themeFromDark(options.data.darkTheme ?? 'default')
  const initialTheme = resolveCurrentTheme(options.data)
  const fontSize = FONT_SIZE_MAP[(options.data.fontSize ?? 'Medium') as FontSize]

  const clone = options.content.cloneNode(true) as HTMLElement
  cleanContent(clone)
  await inlineLocalImages(clone)

  const title = sanitizeFilename(options.filename)
  const html = buildHtmlDocument({
    bodyHtml: clone.innerHTML,
    title,
    lightTheme,
    darkTheme,
    initialTheme,
    css: getExportCss(fontSize),
  })

  downloadBlob(`${title}.html`, html)
}
