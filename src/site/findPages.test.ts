// @vitest-environment node
import { expect, test } from 'vitest'
import { findPages } from '../../vite.config'

test('every page html is a build entry; deps and build output are skipped', () => {
  const pages = findPages()
  expect(pages).toHaveProperty('index')
  expect(pages).toHaveProperty('app/index')
  for (const key of Object.keys(pages)) expect(key).not.toMatch(/^(node_modules|dist|storybook-static|public|src)\//)
})
