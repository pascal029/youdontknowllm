import { expect, test } from 'vitest'
import { fromOpenAIChunks, type OpenAIChunk } from './stream'

async function collect(chunks: OpenAIChunk[]) {
  async function* gen() { yield* chunks }
  const out = []
  for await (const c of fromOpenAIChunks(gen())) out.push(c)
  return out
}

test('emits deltas then one done with usage + speed', async () => {
  const out = await collect([
    { choices: [{ delta: { content: 'Hel' } }] },
    { choices: [{ delta: { content: 'lo' } }] },
    { choices: [{ delta: {} }] },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, extra: { prefill_tokens_per_s: 100, decode_tokens_per_s: 20 } } },
  ])
  expect(out).toEqual([
    { type: 'delta', text: 'Hel' },
    { type: 'delta', text: 'lo' },
    { type: 'done', usage: { promptTokens: 10, completionTokens: 2, prefillTps: 100, decodeTps: 20 } },
  ])
})

test('still ends with done when the server sends no usage', async () => {
  const out = await collect([{ choices: [{ delta: { content: 'x' } }] }])
  expect(out.at(-1)).toEqual({ type: 'done', usage: { promptTokens: 0, completionTokens: 0 } })
})

test('reasoning fields are inlined as <think>…</think> before the content', async () => {
  const out = await collect([
    { choices: [{ delta: { content: '', reasoning: 'Let me' } }] },
    { choices: [{ delta: { reasoning: ' think' } }] },
    { choices: [{ delta: { content: 'Hi' } }] },
    { choices: [{ delta: { reasoning_content: 'more?' } }] },
  ])
  const text = out.filter((c) => c.type === 'delta').map((c) => (c as { text: string }).text).join('')
  expect(text).toBe('<think>Let me think</think>\nHi<think>more?</think>')
})

test('native tool_calls (streamed in pieces) become our <tool_call> text, after any thinking', async () => {
  const out = await collect([
    { choices: [{ delta: { reasoning: 'Use calculator.' } }] },
    { choices: [{ delta: { content: '', tool_calls: [{ index: 0, function: { name: 'calculator', arguments: '{"expression":' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"1234*5678"}' } }] } }] },
    { choices: [], usage: { prompt_tokens: 234, completion_tokens: 35 } },
  ])
  const text = out.filter((c) => c.type === 'delta').map((c) => (c as { text: string }).text).join('')
  expect(text).toBe('<think>Use calculator.</think><tool_call>{"name":"calculator","arguments":"{\\"expression\\":\\"1234*5678\\"}"}</tool_call>')
  const { parseToolCall } = await import('../agent/parseToolCall')
  expect(parseToolCall(text)).toMatchObject({ kind: 'call', name: 'calculator', arguments: { expression: '1234*5678' } })
  expect(out.at(-1)).toMatchObject({ type: 'done', usage: { promptTokens: 234, completionTokens: 35 } })
})

test('native tool call with no arguments still parses', async () => {
  const out = await collect([{ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'get_current_time' } }] } }] }])
  const text = out.filter((c) => c.type === 'delta').map((c) => (c as { text: string }).text).join('')
  const { parseToolCall } = await import('../agent/parseToolCall')
  expect(parseToolCall(text)).toMatchObject({ kind: 'call', name: 'get_current_time', arguments: {} })
})

test('errors sent inside the stream are surfaced (not silently ignored)', async () => {
  await expect(collect([{ choices: [{ delta: { content: 'Hel' } }] }, { error: { message: 'rate limit exceeded', code: 'rate_limit' } }])).rejects.toThrow(
    'API error: rate limit exceeded',
  )
})

test("Groq's tool_use_failed is recovered as a tool call (gpt-oss called a tool without a native tools list)", async () => {
  const out = await collect([
    { choices: [{ delta: { reasoning: 'Need calculator.' } }] },
    { error: { message: 'Tool choice is none, but model called a tool', code: 'tool_use_failed', failed_generation: '{"name": "calculator", "arguments": {"expression":"1234 * 5678"}}' } },
  ])
  const text = out.filter((c) => c.type === 'delta').map((c) => (c as { text: string }).text).join('')
  expect(text).toBe('<think>Need calculator.</think><tool_call>{"name": "calculator", "arguments": {"expression":"1234 * 5678"}}</tool_call>')
  const { parseToolCall } = await import('../agent/parseToolCall')
  expect(parseToolCall(text)).toMatchObject({ kind: 'call', name: 'calculator', arguments: { expression: '1234 * 5678' } })
  expect(out.at(-1)?.type).toBe('done')
})

test('tool_use_failed without a usable generation is still an error', async () => {
  await expect(collect([{ error: { message: 'Tool choice is none, but model called a tool', code: 'tool_use_failed', failed_generation: 'garbage' } }])).rejects.toThrow(
    'Tool choice is none',
  )
})
