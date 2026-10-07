import { beforeEach, expect, test, vi } from 'vitest'

const cached = new Set(['a', 'c'])
vi.mock('@mlc-ai/web-llm', () => ({
  hasModelInCache: vi.fn(async (id: string) => {
    if (id === 'broken') throw new Error('storage blocked')
    return cached.has(id)
  }),
  deleteModelAllInfoInCache: vi.fn(async (id: string) => {
    cached.delete(id)
  }),
}))

const { cachedModelIds, deleteCachedModel } = await import('./cache')

beforeEach(() => {
  cached.clear()
  cached.add('a').add('c')
})

test('reports which models are cached; storage errors count as not cached', async () => {
  expect(await cachedModelIds(['a', 'b', 'c', 'broken'])).toEqual(new Set(['a', 'c']))
})

test('delete removes the model from the cache', async () => {
  await deleteCachedModel('a')
  expect(await cachedModelIds(['a', 'c'])).toEqual(new Set(['c']))
})
