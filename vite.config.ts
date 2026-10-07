import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { findPages, partials, seoFiles } from './site.build.ts'
import { RELAYED_ORIGINS } from './src/llm/relay.ts'

// Same relay as netlify.toml, for `npm run dev` / `npm run preview`.
const relay = Object.fromEntries(
  Object.entries(RELAYED_ORIGINS).map(([target, prefix]) => [prefix, { target, changeOrigin: true, rewrite: (p: string) => p.slice(prefix.length) }]),
)

export default defineConfig({
  plugins: [react(), partials(), seoFiles()],
  server: { proxy: relay },
  preview: { proxy: relay },
  build: {
    chunkSizeWarningLimit: 7000, // ponytail: WebLLM is ~6MB but lazy-loaded only when a local model is chosen
    rollupOptions: { input: findPages() },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
