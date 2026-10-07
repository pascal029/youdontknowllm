// @vitest-environment jsdom
// Builds the real site into a temp dir and checks every page the way a crawler would see it.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { SITE_URL } from '../../site.config'

const ROOT = join(import.meta.dirname, '../..')
const OUT = mkdtempSync(join(tmpdir(), 'ydkl-seo-'))

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]))
const urlOf = (file: string) => '/' + relative(OUT, file).replace(/index\.html$/, '').replace(/\.html$/, '')

let pages: { url: string; html: string; doc: Document }[] = []
let sitemap = ''

beforeAll(async () => {
  await build({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), logLevel: 'silent', build: { outDir: OUT, emptyOutDir: true } })
  pages = walk(OUT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => {
      const html = readFileSync(f, 'utf8')
      return { url: urlOf(f), html, doc: new DOMParser().parseFromString(html, 'text/html') }
    })
  sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf8')
}, 60_000)
afterAll(() => rmSync(OUT, { recursive: true, force: true }))

const meta = (doc: Document, sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? ''
const indexable = () => pages.filter((p) => p.url !== '/404')

test('builds the expected pages', () => {
  expect(pages.map((p) => p.url).sort()).toEqual(
    ['/', '/404', '/app/', '/learn/', ...['context-window', 'function-calling', 'prefill-vs-decode', 'run-llm-in-browser', 'system-prompt', 'what-is-a-token'].map((s) => `/learn/${s}/`)].sort(),
  )
})

describe('every indexable page', () => {
  test('has no unprocessed template markers', () => {
    for (const p of pages) expect(p.html, p.url).not.toMatch(/@include|%SITE_(URL|NAME)%/)
  })

  test('lang, title ≤ 60 and description 70–155, all unique', () => {
    const titles = new Set<string>()
    const descs = new Set<string>()
    for (const { url, doc } of indexable()) {
      expect(doc.documentElement.lang, url).toBe('en')
      expect(doc.title.length, `${url} title`).toBeGreaterThan(10)
      expect(doc.title.length, `${url} title`).toBeLessThanOrEqual(60)
      const d = meta(doc, 'meta[name="description"]')
      expect(d.length, `${url} description`).toBeGreaterThanOrEqual(70)
      expect(d.length, `${url} description`).toBeLessThanOrEqual(155)
      titles.add(doc.title)
      descs.add(d)
    }
    expect(titles.size).toBe(indexable().length)
    expect(descs.size).toBe(indexable().length)
  })

  test('canonical and og:url are the absolute URL of the page itself', () => {
    for (const { url, doc } of indexable()) {
      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
      expect(canonical, url).toBe(SITE_URL + url)
      expect(meta(doc, 'meta[property="og:url"]'), url).toBe(canonical)
    }
  })

  test('Open Graph + Twitter card complete, og:image exists in the build', () => {
    for (const { url, doc } of indexable()) {
      for (const p of ['og:type', 'og:title', 'og:description', 'og:site_name']) expect(meta(doc, `meta[property="${p}"]`), `${url} ${p}`).not.toBe('')
      expect(meta(doc, 'meta[name="twitter:card"]'), url).toBe('summary_large_image')
      const img = meta(doc, 'meta[property="og:image"]')
      expect(img.startsWith(SITE_URL + '/'), url).toBe(true)
      expect(existsSync(join(OUT, img.slice(SITE_URL.length))), `${url} og:image file`).toBe(true)
    }
  })

  test('exactly one h1', () => {
    for (const { url, doc } of indexable()) expect(doc.querySelectorAll('h1').length, url).toBe(1)
  })

  test('JSON-LD is valid and only uses absolute site URLs', () => {
    for (const { url, doc } of indexable()) {
      const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')]
      expect(blocks.length, url).toBeGreaterThan(0)
      for (const b of blocks) {
        const text = b.textContent!
        expect(() => JSON.parse(text), url).not.toThrow()
        for (const [, u] of text.matchAll(/"(?:url|item)":\s*"([^"]+)"/g)) expect(u.startsWith(SITE_URL), `${url} → ${u}`).toBe(true)
      }
    }
  })

  test('is listed in sitemap.xml', () => {
    for (const { url } of indexable()) expect(sitemap, url).toContain(`<loc>${SITE_URL}${url}</loc>`)
  })
})

test('no broken internal links', () => {
  const exists = (href: string) => {
    const path = href.split('#')[0]
    if (path.endsWith('/')) return existsSync(join(OUT, path, 'index.html'))
    return existsSync(join(OUT, path)) || existsSync(join(OUT, path + '.html'))
  }
  for (const { url, doc } of pages)
    for (const a of doc.querySelectorAll('a[href^="/"]')) expect(exists(a.getAttribute('href')!), `${url} → ${a.getAttribute('href')}`).toBe(true)
})

test('404 page is noindex and not in the sitemap; robots.txt points at the sitemap', () => {
  const nf = pages.find((p) => p.url === '/404')!
  expect(meta(nf.doc, 'meta[name="robots"]')).toBe('noindex')
  expect(sitemap).not.toContain('404')
  expect(readFileSync(join(OUT, 'robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
})

test('static pages ship no JavaScript bundles (fast + fully crawlable)', () => {
  for (const { url, doc } of pages.filter((p) => p.url !== '/app/')) {
    const scripts = [...doc.querySelectorAll('script')].filter((s) => s.type !== 'application/ld+json')
    expect(scripts, url).toHaveLength(0)
  }
})
