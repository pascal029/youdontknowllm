import { describe, expect, test } from 'vitest'
import { parseToolCall, splitThink } from './parseToolCall'

describe('answers', () => {
  test('plain text is an answer', () => {
    expect(parseToolCall('The answer is 437.')).toEqual({ kind: 'answer', text: 'The answer is 437.' })
  })
  test('think blocks are removed from answers', () => {
    expect(parseToolCall('<think>hmm</think>\nHello')).toEqual({ kind: 'answer', text: 'Hello' })
  })
  test('JSON that is not a tool call stays an answer', () => {
    expect(parseToolCall('{"color": "red"}').kind).toBe('answer')
  })
  test('prose mentioning "name" with braces inside is an answer', () => {
    expect(parseToolCall('Use {"name": "x"} like this in your code').kind).toBe('answer')
  })
})

describe('calls', () => {
  test('Gemma-style closing token <tool_call|> and a trailing <|tool_response>', () => {
    expect(parseToolCall('<tool_call>{"name": "calculator", "arguments": {"expression": "123 * 456"}}<tool_call|><|tool_response>')).toMatchObject({
      kind: 'call', name: 'calculator', arguments: { expression: '123 * 456' },
    })
  })
  test('tagged call', () => {
    expect(parseToolCall('<tool_call>{"name": "calculator", "arguments": {"expression": "23*19"}}</tool_call>')).toMatchObject({
      kind: 'call', name: 'calculator', arguments: { expression: '23*19' },
    })
  })
  test('text around the tag and a think block', () => {
    const r = parseToolCall('<think>need math</think>Let me check.\n<tool_call>\n{"name":"calculator","arguments":{"expression":"1+1"}}\n</tool_call>')
    expect(r).toMatchObject({ kind: 'call', name: 'calculator' })
  })
  test('missing closing tag (generation stopped)', () => {
    expect(parseToolCall('<tool_call>{"name":"get_current_time","arguments":{}}')).toMatchObject({ kind: 'call', name: 'get_current_time' })
  })
  test('code fence inside the tag', () => {
    expect(parseToolCall('<tool_call>```json\n{"name":"a","arguments":{}}\n```</tool_call>')).toMatchObject({ kind: 'call', name: 'a' })
  })
  test('arguments double-encoded as a string', () => {
    expect(parseToolCall('<tool_call>{"name":"a","arguments":"{\\"x\\":1}"}</tool_call>')).toMatchObject({ kind: 'call', arguments: { x: 1 } })
  })
  test('missing arguments defaults to {}', () => {
    expect(parseToolCall('<tool_call>{"name":"a"}</tool_call>')).toMatchObject({ kind: 'call', arguments: {} })
  })
  test('bare JSON call without tags', () => {
    expect(parseToolCall('```json\n{"name":"calculator","arguments":{"expression":"2+2"}}\n```')).toMatchObject({ kind: 'call', name: 'calculator' })
  })
})

describe('errors', () => {
  test('invalid JSON', () => {
    expect(parseToolCall('<tool_call>{name: calculator}</tool_call>')).toMatchObject({ kind: 'error', error: expect.stringMatching(/not valid JSON/) })
  })
  test('missing name', () => {
    expect(parseToolCall('<tool_call>{"arguments":{}}</tool_call>')).toMatchObject({ kind: 'error', error: expect.stringMatching(/name/) })
  })
  test('arguments not an object', () => {
    expect(parseToolCall('<tool_call>{"name":"a","arguments":[1]}</tool_call>')).toMatchObject({ kind: 'error', error: expect.stringMatching(/object/) })
  })
})

describe('gpt-oss wrapper confusion', () => {
  test('{"name":"tool_call","arguments":{"name":X,...}} is unwrapped to X', () => {
    expect(parseToolCall('<tool_call>{"name": "tool_call", "arguments": {"name":"calculator","arguments":{"expression":"1234 * 5678"}}}</tool_call>')).toMatchObject({
      kind: 'call',
      name: 'calculator',
      arguments: { expression: '1234 * 5678' },
    })
  })
  test('works with double-encoded inner arguments and missing inner arguments', () => {
    expect(parseToolCall('<tool_call>{"name":"tool_call","arguments":"{\\"name\\":\\"calculator\\",\\"arguments\\":\\"{\\\\\\"expression\\\\\\":\\\\\\"2+2\\\\\\"}\\"}"}</tool_call>')).toMatchObject({ kind: 'call', name: 'calculator', arguments: { expression: '2+2' } })
    expect(parseToolCall('<tool_call>{"name":"tool_call","arguments":{"name":"get_current_time"}}</tool_call>')).toMatchObject({ kind: 'call', name: 'get_current_time', arguments: {} })
  })
  test('a real tool literally named tool_call without an inner name is left alone', () => {
    expect(parseToolCall('<tool_call>{"name":"tool_call","arguments":{"x":1}}</tool_call>')).toMatchObject({ kind: 'call', name: 'tool_call', arguments: { x: 1 } })
  })
})

describe('tool call hidden in thinking (Groq + gpt-oss)', () => {
  test('used when the reply has no visible text', () => {
    expect(parseToolCall('<think>We need to use calculator tool.<tool_call>{"name": "calculator", "arguments": {"expression": "1234 * 5678"}}</think>')).toMatchObject({
      kind: 'call',
      name: 'calculator',
      arguments: { expression: '1234 * 5678' },
    })
  })
  test('ignored when there is a visible answer', () => {
    expect(parseToolCall('<think>maybe <tool_call>{"name":"calculator","arguments":{}}</tool_call>? no.</think>It is 4.')).toEqual({ kind: 'answer', text: 'It is 4.' })
  })
})

describe('splitThink', () => {
  test('separates reasoning from the visible text, joining several blocks', () => {
    expect(splitThink('<think> a </think>Hi<think>b</think>')).toEqual({ thinking: 'a\n\nb', text: 'Hi' })
  })
  test('an unclosed block (still streaming) counts as thinking', () => {
    expect(splitThink('<think>working on it')).toEqual({ thinking: 'working on it', text: '' })
  })
  test('no thinking', () => {
    expect(splitThink('Hello')).toEqual({ thinking: '', text: 'Hello' })
  })
})
