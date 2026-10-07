// @vitest-environment node
import { expect, test } from 'vitest'
import { SITE_URL } from '../../site.config'
import { applyPartials, findPages } from '../../vite.config'

test('includes partials by name and fills site variables', () => {
  const read = (name: string) => `[${name}]`
  expect(applyPartials('<head><!-- @include head --></head><!--@include footer-->', read)).toBe('<head>[head]</head>[footer]')
  expect(applyPartials('<link rel="canonical" href="%SITE_URL%/learn/" />', read)).toBe(`<link rel="canonical" href="${SITE_URL}/learn/" />`)
})

test('real partials exist for every include used by the pages', async () => {
  const { readFileSync } = await import('node:fs')
  for (const file of Object.values(findPages())) {
    expect(() => applyPartials(readFileSync(file, 'utf8')), file).not.toThrow()
  }
})
