# md-viewer

[English](./README.md) | 简体中文

`md-viewer` 是一个独立开源的浏览器 Markdown 阅读扩展，适用于 Chrome、Brave 以及其他 Chromium 系浏览器。

它基于 [md-reader/md-reader](https://github.com/md-reader/md-reader) 最后公开的 MIT 授权源码继续演进，并对阅读体验、侧边栏导航、本地文件浏览、弹出窗口 UI 和现代构建流程做了较多更新。

本项目不是官方 Markdown Reader 扩展，也不由官方扩展维护者维护或背书。

## 为什么会有这个 Fork

我一直很喜欢 Markdown Reader 这个扩展。原项目曾经以 MIT License 开源发布，感谢 Bener 对开源社区的贡献。

后来官方 3.x 版本不再继续以开源形式维护，因此这个项目基于最后公开的 MIT 授权源码，以及社区维护版本的思路，继续做一个独立、开放的浏览器 Markdown 阅读扩展。

本项目没有使用官方 3.x 的闭源源代码；相关改进是通过观察公开可见的产品行为，并结合开源代码重新实现的。

当前 logo 和部分内部 class name 仍沿用原项目脉络，后续有时间会再做视觉和命名清理。

## 功能

- 支持从 `http://`、`https://`、`file://` 预览 `.md`、`.mdx`、`.mkd`、`.markdown`、`.txt` 文件。
- 支持常见 Markdown 扩展: emoji、上标/下标、任务列表、表格、alert、custom containers、KaTeX 数学公式、Mermaid 图表等。
- 提供可拖动宽度的侧边栏，支持 Files 和 TOC 两种视图。
- 支持在同一个本地目录树内切换 Markdown 文件，不刷新整个扩展 UI。
- 支持 light、dark、auto 主题。
- 支持在页面内的快速设置菜单中调整阅读字号，并持久化保存。
- 支持一键复制代码块。
- 支持图片点击放大预览。
- 支持将当前渲染结果导出为独立 HTML 文件, 含主题切换和打印优化样式。
- 支持可选的自动刷新。
- 支持通过快捷键切换侧边栏、居中布局、自动刷新和主题。

## 导出 HTML

点击页面工具栏的下载按钮, 可将当前 Markdown 渲染结果导出为独立的 `.html` 文件。导出文件会保留你当前的主题偏好, 并提供浅色/深色切换, 以及针对打印优化的样式(例如 blockquote 可读性)。

使用时请注意以下限制:

- **Mermaid**: 导出前会等待页面内 Mermaid 图表渲染完成。
- **图片**: 相对路径和 `file://` 图片在从其他位置打开 HTML 时可能无法显示。如需跨设备分享, 请使用绝对 `http(s)://` 地址。
- **KaTeX**: 导出 HTML 会从 jsDelivr 加载 KaTeX CSS, 离线查看时数学公式样式需要网络。

## 从源码安装

```bash
git clone https://github.com/summereasy/md-reader.git
cd md-reader
pnpm install
pnpm build
```

构建完成后，将 `dist/` 作为 unpacked extension 加载到浏览器。

## 在 Chrome 或 Brave 中加载

1. 打开 `chrome://extensions` 或 `brave://extensions`。
2. 开启 `Developer mode`。
3. 点击 `Load unpacked`。
4. 选择本仓库下的 `dist/` 目录。
5. 如果需要阅读本地 Markdown 文件，请进入扩展详情页并开启 `Allow access to file URLs`。

## 快捷键

| 快捷键 | 动作 |
| --- | --- |
| `⌘B` / `Ctrl+B` | 在 Markdown 渲染页面内切换侧边栏 |
| `Alt+Shift+C` | 切换居中布局 |
| `Alt+Shift+R` | 切换自动刷新 |
| `Alt+Shift+T` | 切换主题 |

## 开发

```bash
pnpm install
pnpm dev
pnpm build
```

项目使用 Vue 3、TypeScript、Vite、UnoCSS、TDesign Vue Next、`markdown-it`、Highlight.js、KaTeX 和 Mermaid 构建。

## 致谢

感谢 [Bener](https://github.com/Heroor) 创建最初的 Markdown Reader 项目，并以 MIT License 发布。

这个 fork 也参考了公开的社区维护版本和公开可观察的产品行为，但实现基于开源代码独立完成。

## 协议

MIT。见 [LICENSE](./LICENSE)。

原项目版权声明会继续保留:

- Copyright (c) 2018-present Bener
- Copyright (c) 2026-present Wei / summereasy
