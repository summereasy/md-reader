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
- Preview desktop and phone layouts: phone mode renders the document inside a selectable phone-width canvas (360–430px presets, 393px by default) with the sidebar as a drawer.
- Adjust reading font size from the in-page quick settings menu; switching display modes applies the mode default (Small on phone, Large on desktop).
- Fine-tune content width as a percentage of the natural reading width, where 100% matches auto.
- Copy code blocks with one click.
- Zoom images in a lightweight viewer.
- Export the rendered page as a standalone HTML file with theme toggle and print-friendly styles.
- Export Markdown to the same standalone HTML from the command line (Bun), for scripting and batch use.
- Auto-refresh source files when enabled.
- Use keyboard shortcuts for sidebar, centered layout, refresh, and theme controls.

## Export HTML

Use the download button in the page toolbar to export the current rendered Markdown as a self-contained `.html` file. The export includes your current theme settings, a light/dark toggle, and print styles tuned for readable blockquotes and body text.

Limitations to keep in mind:

- **Mermaid**: export waits for in-page Mermaid rendering to finish before downloading.
- **Images**: local (`file://`) images are inlined as base64 data URIs so the exported file stays portable. Remote `http(s)://` images keep their original URLs and require network access.
- **KaTeX**: exported HTML loads KaTeX CSS from jsDelivr, so math styling requires network access when viewing the file offline.

## Export HTML From the CLI

The same export is also available from the command line, so you can batch-export files or generate the HTML from a script without opening a browser tab:

```bash
# Write post.html next to the source file
bun run export:html path/to/post.md

# Choose the output path
bun run cli/md-export.ts post.md -o out/post.html

# Write the HTML to stdout (for piping or uploading)
bun run cli/md-export.ts post.md --stdout > post.html
```

The CLI reuses the same `markdown-it` pipeline, export template, CSS, and image compression as the toolbar button, so the result is identical. Run `bun run cli/md-export.ts --help` for all options (`--theme`, `--title`, `--font-size`, `--no-mermaid`, `--no-images`, `--no-compress`, `--browser`, `--no-browser`, ...).

Requirements and fallbacks:

- **Chromium-based browser**: Mermaid diagrams and image compression need a real browser engine, so the CLI launches a headless Chrome/Chromium (auto-detected; override with `--browser <path>` or the `MDR_CHROME` environment variable). Both jobs share a single headless pass, usually taking under a second.
- **No browser found**: the export still succeeds, but Mermaid blocks fall back to plain code blocks and images are inlined without compression. Pass `--no-browser` to skip the browser on purpose.
- **Bun**: the CLI runs on [Bun](https://bun.sh), which this repository's tooling already uses; `pnpm install` installs the dependencies it needs.

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

## Local File Access

Local files (the sidebar file tree, switching between files, auto refresh, and inlining local images when exporting) are read from a hidden extension-origin iframe injected by the content script, not from the MV3 service worker. See `src/content/local-file.ts` and `src/content/file-fetch-frame.ts`.

The reason: a freshly woken MV3 service worker cannot reliably `fetch()` a `file://` URL. The first request inside the worker's startup window is rejected with `Not allowed to load local resource`, and even though the automatic retry then succeeds, that error keeps appearing in the extension's error log. Reading inside an extension-context iframe is stable and leaves no error behind; the worker retry path remains only as a fallback.

## Acknowledgements

Thanks to [Bener](https://github.com/Heroor) for creating the original Markdown Reader project and releasing it under the MIT License.

This fork also benefited from public community-maintained implementations and behavior comparisons while keeping the implementation based on open-source code.

## License

MIT. See [LICENSE](./LICENSE).

Original project copyright is retained:

- Copyright (c) 2018-present Bener
- Copyright (c) 2026-present Wei / summereasy
