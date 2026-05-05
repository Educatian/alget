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
            id.includes('rehype-raw') ||
            id.includes('parse5') ||
            id.includes('hast-util-raw')
          ) {
            return 'markdown-raw'
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('hast') ||
            id.includes('unist') ||
            id.includes('unified') ||
            id.includes('remark-math') ||
            id.includes('rehype-katex') ||
            id.includes(`${'node_modules'}\\katex`) ||
            id.includes(`${'node_modules'}/katex`) ||
            id.includes('vfile')
          ) {
            return 'markdown-stack'
          }

          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**']
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
