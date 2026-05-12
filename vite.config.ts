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
      name: 'copy-static-assets',
      apply: 'build',
      writeBundle() {
        const srcDir = resolve(ROOT, 'src')
        const distDir = resolve(ROOT, 'dist')
        const assetsDist = resolve(distDir, 'assets')

        // Ensure directories exist
        mkdirSync(assetsDist, { recursive: true })

        // Copy manifest
        copyFileSync(resolve(srcDir, 'manifest.json'), resolve(distDir, 'manifest.json'))

        // Copy _locales
        cpSync(resolve(srcDir, '_locales'), resolve(distDir, '_locales'), { recursive: true })

        // Copy static assets
        cpSync(resolve(srcDir, 'assets'), assetsDist, { recursive: true })
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(ROOT, 'src'),
      // Fix mermaid's CJS require of cytoscape.umd.js
      'cytoscape/dist/cytoscape.umd.js': resolve(ROOT, 'node_modules/.pnpm/cytoscape@3.33.3/node_modules/cytoscape/dist/cytoscape.esm.mjs'),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      input: {
        popup: resolve(ROOT, 'popup.html'),
        options: resolve(ROOT, 'options.html'),
        background: resolve(ROOT, 'src/background/index.ts'),
        content: resolve(ROOT, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/index.mjs'
          if (chunk.name === 'content') return 'content/index.global.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
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
