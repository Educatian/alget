import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('remark-math') ||
            id.includes('rehype-katex') ||
            id.includes('rehype-raw') ||
            id.includes('katex')
          ) {
            return 'markdown-stack'
          }

          if (id.includes('@supabase')) {
            return 'supabase'
          }

          if (id.includes('lucide-react')) {
            return 'ui-icons'
          }

          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/')
          ) {
            return 'react-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
