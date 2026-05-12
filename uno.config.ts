import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      primary: '#0052d9',
    },
    breakpoints: {
      sm: '640px',
      md: '960px',
    },
  },
  shortcuts: {
    'btn-primary': 'bg-primary text-white px-4 py-2 rounded hover:opacity-90 transition',
    'flex-center': 'flex items-center justify-center',
  },
})
