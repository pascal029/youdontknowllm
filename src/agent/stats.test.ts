import { expect, test } from 'vitest'
import { contextUsed } from './stats'

test('uses the latest model call', () => {
  expect(contextUsed([])).toBe(0)
  expect(
    contextUsed([
      { type: 'user', text: 'x' },
      { type: 'model', iteration: 1, text: '', usage: { promptTokens: 400, completionTokens: 20 }, ms: 1 },
      { type: 'tool-call', name: 'a', arguments: {} },
      { type: 'model', iteration: 2, text: '', usage: { promptTokens: 450, completionTokens: 30 }, ms: 1 },
      { type: 'answer', text: '' },
    ]),
  ).toBe(480)
})
