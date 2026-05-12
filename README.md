# Markdown Reader

<img alt="Markdown Reader Logo" src="https://raw.githubusercontent.com/md-reader/md-reader/main/src/images/logo-stroke.svg" align="right" width="120">

English | [中文](./README-cn.md) | [한국어](./README-ko.md)

A powerful browser extension for previewing Markdown files in your **Chrome** or **Brave** browser.

> **This is an open-source Vue 3 rewrite of Markdown Reader (v3.x).**
> Original Svelte 2.x source code is on the `main` branch.
> 
> Original author: **Bener** — [https://md-reader.github.io](https://md-reader.github.io)

---

## ✨ Features

- **Rich Document Support**: Preview `.md`, `.mdx`, `.mkd`, `.markdown`, `.txt` files via `http://`, `https://`, `file://`
- **Syntax Plugins**: Emoji, Sup/Sub, Katex Math, Mermaid Diagrams, TOC, Task Lists, Alerts, and more
- **Themes**: Light / Dark / Auto mode with code highlighting
- **Sidebar Navigation**: Auto-generated table of contents with scroll tracking
- **Image Viewer**: Click to zoom images in lightbox
- **Code Block Copy**: One-click code block copy
- **Auto Refresh**: Watch file changes and auto-reload
- **Keyboard Shortcuts**: `Alt+Shift+B/C/R/T` for quick actions
- **Vue 3 + TDesign**: Clean modern UI for popup and settings pages

## 🚀 Quick Start

### Install from Source

```bash
# Clone this repository
git clone https://github.com/summereasy/md-reader.git && cd md-reader

# Install dependencies (pnpm recommended)
pnpm install

# Build the extension
pnpm build
```

Then load `dist/` as an unpacked extension in `chrome://extensions`.

### Load in Brave/Chrome

1. Go to `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Enable **Allow access to file URLs** for local markdown preview

## ⌨️ Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+B` | Toggle sidebar |
| `Alt+Shift+C` | Toggle centered layout |
| `Alt+Shift+R` | Toggle auto refresh |
| `Alt+Shift+T` | Toggle theme (light/dark) |

## 🛠 Tech Stack

- **Framework**: Vue 3 + TypeScript
- **UI Library**: TDesign Vue Next
- **Build Tool**: Vite + UnoCSS
- **Markdown Engine**: markdown-it + highlight.js + Katex + Mermaid

## 📦 Dependencies

The markdown rendering pipeline uses:
- [markdown-it](https://github.com/markdown-it/markdown-it) — core parser
- [highlight.js](https://highlightjs.org/) — code syntax highlighting
- [KaTeX](https://katex.org/) — math rendering
- [Mermaid](https://mermaid.js.org/) — diagram rendering
- Various markdown-it plugins for emoji, TOC, task lists, alerts, etc.

## 📄 License

MIT © 2018-present [Bener](https://github.com/Heroor)

The original 2.x version was created by Bener of the `md-reader` organization.  
This Vue 3 rewrite preserves the MIT license and credits the original author.

This is an independent open-source rewrite. For the official extension, visit [md-reader.github.io](https://md-reader.github.io).
