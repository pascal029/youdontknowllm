import react from '@vitejs/plugin-react'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig } from 'vitest/config'

const ROOT = import.meta.dirname
const SKIP = new Set(['node_modules', 'dist', 'storybook-static', 'public', 'src', 'design-system', '.storybook', '.git'])

/** Every .html under the project = one page in the build (/, /app/, /learn/x/ …). */
export function findPages(dir = ROOT): Record<string, string> {
  const pages: Record<string, string> = {}
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIP.has(name)) Object.assign(pages, findPages(path))
    } else if (name.endsWith('.html')) {
      pages[relative(ROOT, path).replace(/\.html$/, '')] = path
    }
  }
  return pages
}

export default defineConfig({
  plugins: [react()],
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
