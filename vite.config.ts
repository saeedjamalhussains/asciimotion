import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// ASCII Motion is a fully static, client-only application.
//
// `base: './'` emits *relative* asset URLs, which makes a single build work
// both at the domain root (https://user.github.io/) and inside a repository
// subpath (https://user.github.io/repository/) with no rebuild and no server
// rewrites. Navigation uses the hash (`#/editor`) for the same reason.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react'
          if (id.includes('node_modules/mp4-muxer') || id.includes('node_modules/webm-muxer')) {
            return 'muxers'
          }
          return undefined
        },
      },
    },
  },
})
