import { defineConfig, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'
import { copyFileSync, cpSync, mkdirSync } from 'fs'

const ROOT = process.cwd()

// Shared config for extension UI (popup, options, background)
const uiConfig: UserConfig = {
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
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/index.mjs'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't clean, content config will handle that
  },
}

// Separate config for content script — must be a single self-contained IIFE
const contentConfig: UserConfig = {
  resolve: {
    alias: {
      '@': resolve(ROOT, 'src'),
      'cytoscape/dist/cytoscape.umd.js': resolve(ROOT, 'node_modules/.pnpm/cytoscape@3.33.3/node_modules/cytoscape/dist/cytoscape.esm.mjs'),
    },
  },
  build: {
    commonjsOptions: { include: [/node_modules/] },
    lib: {
      entry: resolve(ROOT, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'MdReader',
      fileName: () => 'content/index.global.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.css')) {
            return 'content/style.css'
          }
          return 'assets/[name]-[hash].[ext]'
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
}

export default defineConfig(({ mode }) => {
  // Build content script first (cleans dist), then build UI (adds to dist)
  return mode === 'content' ? contentConfig : uiConfig
})
