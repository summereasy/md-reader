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
- 支持桌面 / 手机显示模式切换：手机模式会把正文放进可选的手机宽度画布中预览（360–430px 预设，默认 393px），侧边栏变为抽屉，方便检查移动端排版。
- 支持在页面内的快速设置菜单中调整阅读字号，并持久化保存；切换显示模式时会自动套用该模式的默认字号（手机 Small，桌面 Large）。
- 支持按阅读宽度百分比微调正文宽度，100% 等同于自动宽度。
- 支持一键复制代码块。
- 支持图片点击放大预览。
- 支持将当前渲染结果导出为独立 HTML 文件, 含主题切换和打印优化样式。
- 支持通过命令行 (Bun) 把 Markdown 导出为同样的独立 HTML 文件, 便于脚本化和批量处理。
- 支持可选的自动刷新。
- 支持通过快捷键切换侧边栏、居中布局、自动刷新和主题。

## 导出 HTML

点击页面工具栏的下载按钮, 可将当前 Markdown 渲染结果导出为独立的 `.html` 文件。导出文件会保留你当前的主题偏好, 并提供浅色/深色切换, 以及针对打印优化的样式(例如 blockquote 可读性)。

使用时请注意以下限制:

- **Mermaid**: 导出前会等待页面内 Mermaid 图表渲染完成。
- **图片**: 本地 (`file://` 或相对路径) 图片会内联为 base64 data URI, 导出的文件可以独立分享; 超过 200KB 或宽度超过 720px 的会先缩放 (宽度最多 720px, 长图最长边 2400px) 并重编码为 JPEG (质量 82), 避免导出文件膨胀; 远程 `http(s)://` 图片保留原地址, 查看时需要网络。
- **KaTeX**: 导出 HTML 会从 jsDelivr 加载 KaTeX CSS, 离线查看时数学公式样式需要网络。

## 命令行导出 HTML

除了页面工具栏的下载按钮, 也可以用命令行导出, 方便批量处理, 或者在脚本里生成后再上传:

```bash
# 在源文件同目录生成 post.html
bun run export:html path/to/post.md

# 指定输出路径
bun run cli/md-export.ts post.md -o out/post.html

# HTML 输出到 stdout (便于管道处理或上传)
bun run cli/md-export.ts post.md --stdout > post.html
```

CLI 和工具栏按钮使用同一套 `markdown-it` 渲染管线、导出模板、CSS 和图片压缩逻辑, 所以结果一致。完整参数见 `bun run cli/md-export.ts --help` (`--theme`、`--title`、`--font-size`、`--no-mermaid`、`--no-images`、`--no-compress`、`--browser`、`--no-browser` 等)。

依赖与降级行为:

- **Chromium 系浏览器**: Mermaid 图表和图片压缩需要真实浏览器引擎, CLI 会自动探测本机的 Chrome/Chromium/Edge/Brave/Vivaldi, 并以 headless 模式启动 (可用 `--browser <path>` 或环境变量 `MDR_CHROME` 指定)。两件事合并成一次浏览器 pass, 通常不到 1 秒。
- **找不到浏览器**: 仍然能导出, 但 Mermaid 会降级成普通代码块, 图片内联但不压缩。也可以用 `--no-browser` 主动跳过浏览器。
- **Bun**: CLI 通过 [Bun](https://bun.sh) 运行 (本仓库工具链已经使用 Bun), `pnpm install` 会装好它依赖的包。

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

## 本地文件读取

本地文件 (侧边栏文件树、文件切换、自动刷新、导出时内联本地图片) 由内容脚本注入的扩展 origin 隐藏 iframe 读取, 而不是由 MV3 Service Worker 读取。相关实现在 `src/content/local-file.ts` 和 `src/content/file-fetch-frame.ts`。

原因: MV3 Service Worker 刚被唤醒时无法稳定 `fetch()` `file://` 地址, 启动窗口内的第一次请求会被 Chrome 拒绝 (`Not allowed to load local resource`), 即使随后自动重试成功, 这条错误也会一直留在扩展的错误日志里。在扩展上下文的 iframe 里读取则稳定可用、不产生错误; background 里的重试逻辑只作为兜底保留。

## 致谢

感谢 [Bener](https://github.com/Heroor) 创建最初的 Markdown Reader 项目，并以 MIT License 发布。

这个 fork 也参考了公开的社区维护版本和公开可观察的产品行为，但实现基于开源代码独立完成。

## 协议

MIT。见 [LICENSE](./LICENSE)。

原项目版权声明会继续保留:

- Copyright (c) 2018-present Bener
- Copyright (c) 2026-present Wei / summereasy
