// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { SITE_URL } from '../../site.config'
import { applyPartials } from '../../vite.config'

const doc = new DOMParser().parseFromString(applyPartials(readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')), 'text/html')
const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? ''

test('search snippet fits: title ≤ 60, description 70–155 chars', () => {
  expect(doc.title.length).toBeLessThanOrEqual(60)
  expect(meta('meta[name="description"]').length).toBeGreaterThanOrEqual(70)
  expect(meta('meta[name="description"]').length).toBeLessThanOrEqual(155)
})

test('canonical + og:url point at the site root', () => {
  expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE_URL}/`)
  expect(meta('meta[property="og:url"]')).toBe(`${SITE_URL}/`)
})

test('one h1, links to the playground and every learn article', () => {
  expect(doc.querySelectorAll('h1')).toHaveLength(1)
  const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'))
  expect(hrefs).toContain('/app/')
  expect(hrefs.filter((h) => h?.startsWith('/learn/') && h !== '/learn/')).toHaveLength(6)
})

test('ships no app JavaScript (only JSON-LD)', () => {
  const scripts = [...doc.querySelectorAll('script')]
  expect(scripts.every((s) => s.type === 'application/ld+json')).toBe(true)
  expect(() => JSON.parse(scripts[0].textContent!)).not.toThrow()
})
