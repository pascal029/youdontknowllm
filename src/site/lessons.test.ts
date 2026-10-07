// @vitest-environment jsdom
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { LESSONS, SITE_URL } from '../../site.config'
import { applyPartials, findPages, lessonItemList, lessonList, lessonMeta, lessonNav, readingMinutes } from '../../site.build'

const ROOT = join(import.meta.dirname, '../..')
const dom = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const fixed = () => 4

test('every lesson has a page, and every learn page is a lesson', () => {
  for (const l of LESSONS) expect(existsSync(join(ROOT, 'learn', l.slug, 'index.html')), l.slug).toBe(true)
  const pages = Object.keys(findPages()).filter((k) => /^learn\/[^/]+\/index$/.test(k)).map((k) => k.split('/')[1])
  expect(pages.sort()).toEqual(LESSONS.map((l) => l.slug).sort())
})

test('reading time is a positive whole number of minutes', () => {
  for (const l of LESSONS) {
    const m = readingMinutes(l.slug)
    expect(Number.isInteger(m) && m >= 1 && m <= 15, `${l.slug}: ${m}`).toBe(true)
  }
})

test('lesson list: numbered rows in LESSONS order, chosen heading level', () => {
  const doc = dom(lessonList('h3', fixed))
  const items = [...doc.querySelectorAll('.path__item')]
  expect(items.map((a) => a.getAttribute('href'))).toEqual(LESSONS.map((l) => `/learn/${l.slug}/`))
  expect(items.map((a) => a.querySelector('.path__num')?.textContent)).toEqual(['01', '02', '03', '04', '05', '06'])
  expect(items.map((a) => a.querySelector('h3')?.textContent)).toEqual(LESSONS.map((l) => l.title))
  expect(items[0].querySelector('.path__meta')?.textContent).toBe('4 min')
})

test('ItemList JSON-LD mirrors LESSONS', () => {
  const ld = JSON.parse(dom(lessonItemList()).querySelector('script')!.textContent!)
  expect(ld.itemListElement.map((i: { url: string }) => i.url)).toEqual(LESSONS.map((l) => `${SITE_URL}/learn/${l.slug}/`))
})

test('lesson meta: "Lesson n of N · x min read"', () => {
  expect(dom(lessonMeta(LESSONS[2].slug, fixed)).body.textContent).toBe(`Lesson 3 of ${LESSONS.length} · 4 min read`)
})

describe('prev / next navigation', () => {
  const nav = (slug: string) => {
    const links = [...dom(lessonNav(slug)).querySelectorAll('a')]
    return links.map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel'), title: a.querySelector('.lesson-nav__title')?.textContent, label: a.querySelector('.lesson-nav__label')?.textContent }))
  }

  test('middle lesson: previous and next lessons with their titles and rel', () => {
    expect(nav(LESSONS[2].slug)).toEqual([
      { href: `/learn/${LESSONS[1].slug}/`, rel: 'prev', title: LESSONS[1].title, label: 'Previous' },
      { href: `/learn/${LESSONS[3].slug}/`, rel: 'next', title: LESSONS[3].title, label: 'Next' },
    ])
  })

  test('first lesson goes back to all guides; last lesson goes on to the playground', () => {
    expect(nav(LESSONS[0].slug)[0]).toEqual({ href: '/learn/', rel: null, title: 'All guides', label: 'Back' })
    expect(nav(LESSONS.at(-1)!.slug)[1]).toEqual({ href: '/app/', rel: null, title: 'Open the playground', label: 'Now try it' })
  })

  test('unknown slug fails loudly', () => {
    expect(() => lessonNav('nope')).toThrow(/not in LESSONS/)
  })
})

test('markers resolve per file; lesson markers outside a lesson page throw', () => {
  const read = () => ''
  const file = join(ROOT, 'learn', LESSONS[0].slug, 'index.html')
  expect(applyPartials('<!-- @lesson:nav -->', read, file)).toContain('lesson-nav')
  expect(applyPartials('<!-- @lessons:list h3 -->', read)).toContain('<h3 class="path__title">')
  expect(() => applyPartials('<!-- @lesson:nav -->', read, join(ROOT, 'index.html'))).toThrow(/outside a lesson page/)
})
