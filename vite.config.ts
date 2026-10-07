import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { SITE_NAME, SITE_URL } from './site.config.ts'

const ROOT = import.meta.dirname
const SKIP = new Set(['node_modules', 'dist', 'storybook-static', 'public', 'src', 'design-system', 'partials', '.storybook', '.git'])

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

/** `<!-- @include name -->` → partials/name.html, and `%SITE_URL%` / `%SITE_NAME%` → site.config values. */
export function applyPartials(html: string, read = (name: string) => readFileSync(join(ROOT, 'partials', `${name}.html`), 'utf8')) {
  return html
    .replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name: string) => read(name))
    .replaceAll('%SITE_URL%', SITE_URL)
    .replaceAll('%SITE_NAME%', SITE_NAME)
}

/** Page key (from findPages) → public path: 'index' → '/', 'learn/x/index' → '/learn/x/'. */
export const pagePath = (key: string) => '/' + key.replace(/(^|\/)index$/, '$1')

/** Pages that should be indexed (everything except the 404 page). */
export const sitemapXml = (keys: string[], date: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${keys
  .filter((k) => k !== '404')
  .map(pagePath)
  .sort()
  .map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${date}</lastmod></url>`)
  .join('\n')}
</urlset>
`

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`

const seoFiles = (): Plugin => ({
  name: 'seo-files',
  apply: 'build',
  generateBundle() {
    const date = new Date().toISOString().slice(0, 10)
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(Object.keys(findPages()), date) })
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() })
  },
})

const partials = (): Plugin => ({ name: 'partials', transformIndexHtml: { order: 'pre', handler: (html) => applyPartials(html) } })

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
