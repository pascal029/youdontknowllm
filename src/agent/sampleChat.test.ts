import { expect, test } from 'vitest'
import type { Message } from '../llm/types'
import { historyTokens, isToolTraffic } from './compact'
import { fillHistory } from './sampleChat'

test('fills an empty chat close to the target without going over, starting with the facts turn', () => {
  const { history, shown } = fillHistory([], 3000)
  expect(historyTokens(history)).toBeLessThanOrEqual(3000)
  expect(historyTokens(history)).toBeGreaterThan(3000 - 150) // the smallest filler turn no longer fits
  expect(history[0].content).toMatch(/My name is Ana/)
  expect(history.some(isToolTraffic)).toBe(true)
  // the chat only shows questions and answers, never tool plumbing
  expect(shown.some(isToolTraffic)).toBe(false)
  expect(shown.length).toBeLessThan(history.length)
})

test('appends to an existing chat without repeating the facts turn', () => {
  const existing: Message[] = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }]
  const { history } = fillHistory(existing, 1000)
  expect(history.slice(0, 2)).toEqual(existing)
  expect(history.slice(2).some((m) => m.content.includes('Ana'))).toBe(false)
})

test('already above the target → adds nothing to a non-empty chat', () => {
  const existing: Message[] = [{ role: 'user', content: 'x'.repeat(4000) }]
  expect(fillHistory(existing, 500)).toEqual({ history: existing, shown: [] })
})
