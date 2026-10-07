// Build helpers for the static site (landing, learn, crawler files). Used by vite.config.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'
import { LESSONS, SITE_NAME, SITE_URL } from './site.config.ts'

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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Minutes to read a lesson: words inside <article>, 200 wpm, at least 1. */
export function readingMinutes(slug: string): number {
  const html = readFileSync(join(ROOT, 'learn', slug, 'index.html'), 'utf8')
  const article = html.match(/<article[\s\S]*<\/article>/)?.[0] ?? ''
  const words = article.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

const ARROW = '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
const ARROW_LEFT = ARROW.replace('M5 12h14M13 6l6 6-6 6', 'M19 12H5M11 6l-6 6 6 6')

/** Numbered learning path. `heading` = h2 on /learn/, h3 inside a landing section. */
export function lessonList(heading = 'h2', minutes = readingMinutes): string {
  const rows = LESSONS.map(
    (l, i) => `<li><a class="path__item" href="/learn/${l.slug}/">
          <span class="path__num">${String(i + 1).padStart(2, '0')}</span>
          <span class="path__body"><${heading} class="path__title">${esc(l.title)}</${heading}><span class="path__blurb">${esc(l.blurb)}</span></span>
          <span class="path__meta">${minutes(l.slug)} min</span>
          ${ARROW}
        </a></li>`,
  )
  return `<ol class="path">\n        ${rows.join('\n        ')}\n      </ol>`
}

/** "6 lessons · 18 min total" */
export const lessonSummary = (minutes = readingMinutes) =>
  `${LESSONS.length} lessons · ${LESSONS.reduce((n, l) => n + minutes(l.slug), 0)} min total`

/** ItemList JSON-LD for the lesson index. */
export const lessonItemList = () =>
  `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Learn how LLMs work',
    itemListElement: LESSONS.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/learn/${l.slug}/`, name: l.title })),
  })}</script>`

const lessonIndex = (slug: string) => {
  const i = LESSONS.findIndex((l) => l.slug === slug)
  if (i < 0) throw new Error(`"${slug}" is not in LESSONS (site.config.ts)`)
  return i
}

/** "Lesson 3 of 6 · 4 min read" */
export const lessonMeta = (slug: string, minutes = readingMinutes) =>
  `<p class="lesson-meta">Lesson ${lessonIndex(slug) + 1} of ${LESSONS.length} · ${minutes(slug)} min read</p>`

/** Previous / Next cards with lesson titles. Ends link back to the index and on to the playground. */
export function lessonNav(slug: string): string {
  const i = lessonIndex(slug)
  const prev = LESSONS[i - 1]
  const next = LESSONS[i + 1]
  const card = (dir: 'prev' | 'next', href: string, title: string, label: string, rel: boolean) =>
    `<a class="lesson-nav__link lesson-nav__link--${dir}" href="${href}"${rel ? ` rel="${dir}"` : ''}>
          <span class="lesson-nav__label">${dir === 'prev' ? ARROW_LEFT : ''}${label}${dir === 'next' ? ARROW : ''}</span>
          <span class="lesson-nav__title">${esc(title)}</span>
        </a>`
  return `<nav class="lesson-nav" aria-label="Lessons">
        ${prev ? card('prev', `/learn/${prev.slug}/`, prev.title, 'Previous', true) : card('prev', '/learn/', 'All guides', 'Back', false)}
        ${next ? card('next', `/learn/${next.slug}/`, next.title, 'Next', true) : card('next', '/app/', 'Open the playground', 'Now try it', false)}
      </nav>`
}

/** Slug of a lesson page from its file path (…/learn/<slug>/index.html), else null. */
const slugOf = (file?: string) => file?.match(/learn\/([^/]+)\/index\.html$/)?.[1] ?? null

/**
 * Build-time template markers:
 *  `<!-- @include name -->`        → partials/name.html
 *  `<!-- @lessons:list [h2|h3] -->` → numbered lesson path
 *  `<!-- @lessons:itemlist -->`     → ItemList JSON-LD
 *  `<!-- @lessons:summary -->`      → "6 lessons · 18 min total"
 *  `<!-- @lesson:meta -->` / `<!-- @lesson:nav -->` → for the current lesson page
 *  `%SITE_URL%` / `%SITE_NAME%`     → site.config values
 */
export function applyPartials(html: string, read = (name: string) => readFileSync(join(ROOT, 'partials', `${name}.html`), 'utf8'), file?: string) {
  const slug = slugOf(file)
  const needSlug = (marker: string) => {
    if (!slug) throw new Error(`${marker} used outside a lesson page (${file ?? 'unknown file'})`)
    return slug
  }
  return html
    .replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name: string) => read(name))
    .replace(/<!--\s*@lessons:list(?:\s+(h2|h3))?\s*-->/g, (_, h?: string) => lessonList(h ?? 'h2'))
    .replace(/<!--\s*@lessons:itemlist\s*-->/g, () => lessonItemList())
    .replace(/<!--\s*@lessons:summary\s*-->/g, () => lessonSummary())
    .replace(/<!--\s*@lesson:meta\s*-->/g, () => lessonMeta(needSlug('@lesson:meta')))
    .replace(/<!--\s*@lesson:nav\s*-->/g, () => lessonNav(needSlug('@lesson:nav')))
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

type PageInfo = { key: string; title: string; description: string }

const decodeEntities = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&(quot|lt|gt|amp);/g, (_, e: string) => ({ quot: '"', lt: '<', gt: '>', amp: '&' })[e]!)

/** Title + description of every page, read from the source HTML (template markers resolved). */
export const pageInfo = (): PageInfo[] =>
  Object.entries(findPages()).map(([key, file]) => {
    const html = applyPartials(readFileSync(file, 'utf8'), undefined, file)
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1].replace(/ \| youdontknowllm$/, '') ?? key
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
    return { key, title: decodeEntities(title), description: decodeEntities(description) }
  })

/** llms.txt (https://llmstxt.org): a Markdown map of the site for AI assistants. */
export const llmsTxt = (pages: PageInfo[]) => {
  const link = (p: PageInfo) => `- [${p.title}](${SITE_URL}${pagePath(p.key)}): ${p.description}`
  const guides = pages.filter((p) => /^learn\/[^/]+\/index$/.test(p.key)).sort((a, b) => a.key.localeCompare(b.key))
  const app = pages.find((p) => p.key === 'app/index')!
  return `# ${SITE_NAME}

> Learn how large language models work by running one in your browser. A free, open-source playground (local WebGPU models or any OpenAI-compatible API) that shows the system prompt, tokens, context window, tool calls and inference speed, plus short guides to each concept.

## Guides

${guides.map(link).join('\n')}

## Playground

${link(app)}

## Optional

- [All guides](${SITE_URL}/learn/): index of the guides above
- [Source code](https://github.com/pascal029/youdontknowllm): GitHub repository
`
}

export const seoFiles = (): Plugin => ({
  name: 'seo-files',
  apply: 'build',
  generateBundle() {
    const date = new Date().toISOString().slice(0, 10)
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(Object.keys(findPages()), date) })
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() })
    this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(pageInfo()) })
  },
})

export const partials = (): Plugin => ({
  name: 'partials',
  transformIndexHtml: { order: 'pre', handler: (html, ctx) => applyPartials(html, undefined, ctx.filename) },
})
