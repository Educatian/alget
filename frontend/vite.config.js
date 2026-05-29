import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Raise the warning threshold slightly: with deliberate vendor splitting
    // the largest remaining chunk (katex) is a single cohesive library that
    // cannot be split further without breaking it. Keeps the build log clean
    // without hiding genuinely oversized chunks.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          // Normalise Windows + POSIX path separators so the matchers below
          // behave identically across dev machines and CI.
          const normalized = id.replace(/\\/g, '/')
          const inModule = (name) => normalized.includes(`/node_modules/${name}`)

          // --- KaTeX: large, self-contained math typesetting library. Split it
          // out of the markdown stack so the (rarely-changing) math engine is
          // cached independently from the markdown parsing pipeline. Note:
          // rehype-katex itself stays in markdown-stack (it depends on the
          // shared unist/hast utilities) to avoid a circular chunk graph; only
          // the heavy `katex` engine is isolated here.
          if (inModule('katex') && !inModule('rehype-katex')) {
            return 'katex'
          }

          // --- rehype-raw / HTML reparse pipeline (parse5 + hast-util-raw).
          if (
            inModule('rehype-raw') ||
            inModule('parse5') ||
            inModule('hast-util-raw')
          ) {
            return 'markdown-raw'
          }

          // --- Core markdown parsing/transform pipeline.
          if (
            inModule('react-markdown') ||
            normalized.includes('/remark-') ||
            normalized.includes('/rehype-') ||
            inModule('micromark') ||
            inModule('mdast') ||
            inModule('hast') ||
            inModule('unist') ||
            inModule('unified') ||
            inModule('vfile') ||
            inModule('decode-named-character-reference') ||
            inModule('property-information') ||
            inModule('space-separated-tokens') ||
            inModule('comma-separated-tokens')
          ) {
            return 'markdown-stack'
          }

          // --- React runtime (react + react-dom + scheduler). Largest shared
          // dependency; isolating it gives a long-lived cacheable vendor chunk.
          if (
            inModule('react/') ||
            inModule('react-dom/') ||
            inModule('scheduler')
          ) {
            return 'react-vendor'
          }

          // --- React Router.
          if (inModule('react-router')) {
            return 'router'
          }

          // --- Supabase client + its transitive deps.
          if (
            inModule('@supabase') ||
            inModule('@supabase/supabase-js')
          ) {
            return 'supabase'
          }

          // --- Radix UI primitives (popover, tooltip, floating-ui deps).
          if (
            inModule('@radix-ui') ||
            inModule('@floating-ui')
          ) {
            return 'radix'
          }

          // --- Lucide icon set.
          if (inModule('lucide-react')) {
            return 'lucide'
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
