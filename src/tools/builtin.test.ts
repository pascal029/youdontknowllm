import { afterEach, describe, expect, test, vi } from 'vitest'
import { BUILTIN_TOOLS } from './builtin'
import { validateTool } from './types'

// Run tool code the same way the sandbox worker does (AsyncFunction(args, console)), without a worker.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const run = (name: string, args: object) => {
  const t = BUILTIN_TOOLS.find((x) => x.name === name)!
  return new AsyncFunction('args', 'console', t.code)(args, console)
}

afterEach(() => vi.unstubAllGlobals())

test('all 5 built-ins are valid and uniquely named', () => {
  expect(BUILTIN_TOOLS).toHaveLength(5)
  const names = BUILTIN_TOOLS.map((t) => t.name)
  expect(new Set(names).size).toBe(5)
  for (const t of BUILTIN_TOOLS) expect(validateTool(t), t.name).toEqual([])
})

describe('calculator', () => {
  test.each([
    ['23 * 19', 437],
    ['2 ^ 10', 1024],
    ['sqrt(16) + PI - PI', 4],
    ['(1 + 2) * 3 % 4', 1],
    ['max(3, 7)', 7],
  ])('%s = %d', async (expression, expected) => {
    expect(await run('calculator', { expression })).toBeCloseTo(expected)
  })

  test.each(['alert(1)', 'x = 1', '"a"', '1;2', 'this'])('rejects %s', async (expression) => {
    await expect(run('calculator', { expression })).rejects.toThrow()
  })

  test.each(['constructor', 'toString()', '__proto__'])('rejects inherited name %s as unknown', async (expression) => {
    await expect(run('calculator', { expression })).rejects.toThrow(/Unknown name/)
  })
})

test('get_current_time returns iso + requested timezone', async () => {
  const r = await run('get_current_time', { timezone: 'Asia/Jakarta' })
  expect(r.timezone).toBe('Asia/Jakarta')
  expect(new Date(r.iso).getTime()).toBeGreaterThan(0)
})

test('random_number stays in range and rejects min > max', async () => {
  for (let i = 0; i < 50; i++) {
    const n = await run('random_number', { min: 1, max: 3 })
    expect([1, 2, 3]).toContain(n)
  }
  await expect(run('random_number', { min: 5, max: 1 })).rejects.toThrow()
})

test('run_javascript returns values and supports await', async () => {
  expect(await run('run_javascript', { code: 'return [1,2,3].map(x => x * 2)' })).toEqual([2, 4, 6])
  expect(await run('run_javascript', { code: 'return await Promise.resolve(42)' })).toBe(42)
})

test('wikipedia_search calls the CORS-enabled API and cleans snippets', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ query: { search: [{ title: 'Large language model', snippet: 'A <span class="searchmatch">LLM</span> is &quot;big&quot;' }] } })),
  )
  vi.stubGlobal('fetch', fetchMock)
  const r = await run('wikipedia_search', { query: 'LLM' })
  expect(fetchMock.mock.calls[0][0]).toContain('origin=*')
  expect(fetchMock.mock.calls[0][0]).toContain('srsearch=LLM')
  expect(r).toEqual([{ title: 'Large language model', snippet: 'A LLM is "big"', url: 'https://en.wikipedia.org/wiki/Large_language_model' }])
})
