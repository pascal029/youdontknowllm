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
