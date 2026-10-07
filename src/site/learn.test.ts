// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { SITE_URL } from '../../site.config'
import { applyPartials, findPages } from '../../site.build'

const load = (file: string) => new DOMParser().parseFromString(applyPartials(readFileSync(file, 'utf8')), 'text/html')
const jsonLd = (doc: Document) => [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => [JSON.parse(s.textContent!)].flat())
const pages = findPages()
const articles = Object.entries(pages).filter(([k]) => /^learn\/[^/]+\/index$/.test(k))

test('learn index lists every article (links + ItemList JSON-LD), plus the planned ones', () => {
  const doc = load(pages['learn/index'])
  const links = [...doc.querySelectorAll('main a')].map((a) => a.getAttribute('href'))
  const listed = jsonLd(doc).find((x) => x['@type'] === 'ItemList').itemListElement.map((i: { url: string }) => i.url)
  expect(listed).toEqual(links.map((l) => SITE_URL + l))
  for (const [key] of articles) expect(links).toContain('/' + key.replace(/index$/, ''))
})

test.each(articles)('%s: TechArticle + breadcrumb JSON-LD match the canonical URL', (key, file) => {
  const doc = load(file)
  const url = `${SITE_URL}/${key.replace(/index$/, '')}`
  expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(url)
  const ld = jsonLd(doc)
  const article = ld.find((x) => x['@type'] === 'TechArticle')
  expect(article.url).toBe(url)
  expect(article.headline).toBe(doc.querySelector('h1')?.textContent)
  const crumbs = ld.find((x) => x['@type'] === 'BreadcrumbList').itemListElement
  expect(crumbs.at(-1).item).toBe(url)
  expect(doc.querySelector('a[href="/app/"]')).not.toBeNull()
})
