import { expect, test } from 'vitest'
import { composeSystemPrompt } from './prompt'

test('no tools: system prompt unchanged', () => {
  expect(composeSystemPrompt('Be nice.', [])).toBe('Be nice.')
})

test('with tools: appends the call format and one JSON line per tool', () => {
  const out = composeSystemPrompt('Be nice.', [
    { name: 'calculator', description: 'Do math', parameters: { type: 'object', properties: { expression: { type: 'string' } } } },
  ])
  expect(out.startsWith('Be nice.\n\n# Tools')).toBe(true)
  expect(out).toContain('<tool_call>{"name": "<tool name>"')
  expect(out).toContain('{"name":"calculator","description":"Do math","parameters":{"type":"object","properties":{"expression":{"type":"string"}}}}')
})

test('formatToolResponse wraps name + result as JSON', async () => {
  const { formatToolResponse } = await import('./prompt')
  expect(formatToolResponse('calculator', 437)).toBe('<tool_response>{"name":"calculator","result":437}</tool_response>')
})
