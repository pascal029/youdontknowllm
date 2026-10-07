import { expect, test } from 'vitest'
import { validateTool } from './types'

const ok = { name: 'add_numbers', description: 'Adds', parameters: { type: 'object', properties: { a: { type: 'number' } } }, code: 'return args.a' }

test('valid tool has no errors', () => {
  expect(validateTool(ok)).toEqual([])
})

test.each([
  [{ name: 'Add Numbers' }, /snake_case/],
  [{ name: '1abc' }, /snake_case/],
  [{ description: '  ' }, /Description/],
  [{ parameters: { type: 'string' } }, /type": "object/],
  [{ parameters: [] }, /type": "object/],
  [{ parameters: { type: 'object', properties: [] } }, /properties/],
  [{ code: '' }, /Code/],
])('rejects %j', (patch, msg) => {
  const errors = validateTool({ ...ok, ...patch })
  expect(errors.join(' ')).toMatch(msg)
})

test('rejects duplicate names', () => {
  expect(validateTool(ok, ['add_numbers'])[0]).toMatch(/already exists/)
})

test('exampleArgs: explicit example wins, else guessed from the schema', async () => {
  const { exampleArgs } = await import('./types')
  expect(exampleArgs({ parameters: { type: 'object' }, example: { q: 'x' } })).toEqual({ q: 'x' })
  expect(
    exampleArgs({
      parameters: { type: 'object', properties: { s: { type: 'string' }, n: { type: 'integer' }, b: { type: 'boolean' }, a: { type: 'array' }, o: { type: 'object' }, u: {} } },
    }),
  ).toEqual({ s: 'hello', n: 1, b: true, a: [], o: {}, u: 'hello' })
  expect(exampleArgs({ parameters: { type: 'object' } })).toEqual({})
})
