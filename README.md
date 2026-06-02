# md-viewer

English | [简体中文](./README-cn.md)

`md-viewer` is an independent open-source browser extension for reading Markdown files directly in Chrome, Brave, and other Chromium-based browsers.

It is based on the last publicly available MIT-licensed source code of [md-reader/md-reader](https://github.com/md-reader/md-reader), with substantial updates to the rendering experience, sidebar navigation, local file browsing, popup UI, and modern build setup.

This project is not affiliated with, endorsed by, or maintained by the official Markdown Reader extension.

## Why This Fork Exists

I have used and liked Markdown Reader for a long time. The original project was released under the MIT License, and I appreciate Bener's contribution to the open-source community.

After the official 3.x extension moved away from open-source development, this project continues the idea as an independent open-source fork. The improvements here are reimplemented by observing public behavior and by building on MIT-licensed source code and community-maintained references. No closed-source 3.x source code is used.

The logo and some internal class names still come from the original project lineage for now. They may be replaced in a future cleanup.

## Features

- Preview `.md`, `.mdx`, `.mkd`, `.markdown`, and `.txt` files from `http://`, `https://`, and `file://` URLs.
- Render common Markdown extensions: emoji, superscript/subscript, task lists, tables, alerts, custom containers, KaTeX math, Mermaid diagrams, and more.
- Use a resizable sidebar with Files and TOC views.
- Browse local Markdown files from the same directory tree without reloading the extension UI.
- Switch between light, dark, and auto themes.
- Adjust reading font size from the in-page quick settings menu.
- Copy code blocks with one click.
- Zoom images in a lightweight viewer.
- Export the rendered page as a standalone HTML file with theme toggle and print-friendly styles.
- Auto-refresh source files when enabled.
- Use keyboard shortcuts for sidebar, centered layout, refresh, and theme controls.

## Export HTML

Use the download button in the page toolbar to export the current rendered Markdown as a self-contained `.html` file. The export includes your current theme settings, a light/dark toggle, and print styles tuned for readable blockquotes and body text.

Limitations to keep in mind:

- **Mermaid**: export waits for in-page Mermaid rendering to finish before downloading.
- **Images**: relative paths and `file://` images may not display when the HTML is opened from another location. Use absolute `http(s)://` URLs for portable exports.
- **KaTeX**: exported HTML loads KaTeX CSS from jsDelivr, so math styling requires network access when viewing the file offline.

## Install From Source

```bash
git clone https://github.com/summereasy/md-reader.git
cd md-reader
pnpm install
pnpm build
```

Then load `dist/` as an unpacked extension.

## Load In Chrome Or Brave

1. Open `chrome://extensions` or `brave://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `dist/` folder from this repository.
5. For local Markdown files, open the extension details page and enable `Allow access to file URLs`.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘B` / `Ctrl+B` | Toggle sidebar on rendered Markdown pages |
| `Alt+Shift+C` | Toggle centered layout |
| `Alt+Shift+R` | Toggle auto refresh |
| `Alt+Shift+T` | Toggle theme |

## Development

```bash
pnpm install
pnpm dev
pnpm build
```

The extension is built with Vue 3, TypeScript, Vite, UnoCSS, TDesign Vue Next, `markdown-it`, Highlight.js, KaTeX, and Mermaid.

## Acknowledgements

Thanks to [Bener](https://github.com/Heroor) for creating the original Markdown Reader project and releasing it under the MIT License.

This fork also benefited from public community-maintained implementations and behavior comparisons while keeping the implementation based on open-source code.

## License

MIT. See [LICENSE](./LICENSE).

Original project copyright is retained:

- Copyright (c) 2018-present Bener
- Copyright (c) 2026-present Wei / summereasy
