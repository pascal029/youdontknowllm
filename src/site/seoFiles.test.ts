// @vitest-environment node
import { expect, test } from 'vitest'
import { SITE_URL } from '../../site.config'
import { findPages, pagePath, robotsTxt, sitemapXml } from '../../vite.config'

test('page keys map to clean URLs', () => {
  expect(pagePath('index')).toBe('/')
  expect(pagePath('app/index')).toBe('/app/')
  expect(pagePath('learn/context-window/index')).toBe('/learn/context-window/')
  expect(pagePath('404')).toBe('/404')
})

test('sitemap lists every real page with absolute URLs, but not the 404', () => {
  const xml = sitemapXml(Object.keys(findPages()), '2026-10-07')
  expect(xml).toContain(`<loc>${SITE_URL}/</loc>`)
  expect(xml).toContain(`<loc>${SITE_URL}/app/</loc>`)
  expect(xml).toContain(`<loc>${SITE_URL}/learn/function-calling/</loc>`)
  expect(xml).not.toContain('404')
  expect(xml.match(/<url>/g)).toHaveLength(Object.keys(findPages()).length - 1)
  expect(xml).toContain('<lastmod>2026-10-07</lastmod>')
})

test('robots.txt allows crawling and points at the sitemap', () => {
  expect(robotsTxt()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
})

test('llms.txt follows llmstxt.org: H1, summary quote, sections with absolute links to every guide + the app', async () => {
  const { llmsTxt, pageInfo } = await import('../../vite.config')
  const txt = llmsTxt(pageInfo())
  expect(txt.startsWith('# youdontknowllm\n\n> ')).toBe(true)
  expect(txt).toContain('## Guides')
  const guideKeys = Object.keys(findPages()).filter((k) => /^learn\/[^/]+\/index$/.test(k))
  for (const k of guideKeys) expect(txt).toContain(`](${SITE_URL}${pagePath(k)}): `)
  expect(txt).toContain(`](${SITE_URL}/app/): `)
  expect(txt).not.toMatch(/\]\([^)]*\): \n/) // every link has a description
  expect(txt).not.toMatch(/&(#x?[0-9a-f]+|quot|amp|lt|gt);/i) // plain text, not HTML entities
  expect(txt).toContain("they're good at")
})
