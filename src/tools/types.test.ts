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
