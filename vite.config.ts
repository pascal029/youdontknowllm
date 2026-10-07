import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { findPages, partials, seoFiles } from './site.build.ts'

export default defineConfig({
  plugins: [react(), partials(), seoFiles()],
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
