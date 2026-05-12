import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'
import { copyFileSync, cpSync, mkdirSync } from 'fs'

const ROOT = process.cwd()

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    {
      name: 'copy-manifest-and-assets',
      apply: 'build',
      writeBundle() {
        const srcDir = resolve(ROOT, 'src')
        const distDir = resolve(ROOT, 'dist')
        const assetsDist = resolve(distDir, 'assets')
        mkdirSync(assetsDist, { recursive: true })
        copyFileSync(resolve(srcDir, 'manifest.json'), resolve(distDir, 'manifest.json'))
        cpSync(resolve(srcDir, '_locales'), resolve(distDir, '_locales'), { recursive: true })
        cpSync(resolve(srcDir, 'assets'), assetsDist, { recursive: true })
        cpSync(resolve(ROOT, 'node_modules/katex/dist/fonts'), resolve(assetsDist, 'katex/fonts'), { recursive: true })
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(ROOT, 'src'),
      'cytoscape/dist/cytoscape.umd.js': resolve(ROOT, 'node_modules/.pnpm/cytoscape@3.33.3/node_modules/cytoscape/dist/cytoscape.esm.mjs'),
    },
  },
  build: {
    commonjsOptions: { include: [/node_modules/] },
    rollupOptions: {
      input: {
        popup: resolve(ROOT, 'popup.html'),
        options: resolve(ROOT, 'options.html'),
        background: resolve(ROOT, 'src/background/index.ts'),
        content: resolve(ROOT, 'src/content/index.ts'),
        'md-renderer': resolve(ROOT, 'src/content/renderer-entry.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/index.mjs'
          if (chunk.name === 'content') return 'content/index.global.js'
          if (chunk.name === 'md-renderer') return 'assets/md-renderer.js'
          return 'assets/[name]-[hash].js'
        },
        // Disable chunk splitting for background — Chrome SW can't load cross-chunk ESM imports.
        // Other entries (popup, options, content) handle code splitting fine.
        chunkFileNames: (chunk) => {
          // Put heavy deps (mermaid, katex) in assets/ for dynamic import
          return 'assets/[name]-[hash].js'
        },
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.css')) {
            const originals = asset.originalFileNames ?? []
            if (originals.some((f: string) => f.includes('content/'))) {
              return 'content/style.css'
            }
          }
          return 'assets/[name]-[hash].[ext]'
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})
