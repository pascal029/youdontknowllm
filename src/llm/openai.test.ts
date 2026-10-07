import { afterEach, expect, test, vi } from 'vitest'
import { createOpenAIProvider, parseSSE, withTiming } from './openai'
import type { StreamChunk } from './types'

const sse = (...parts: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(new TextEncoder().encode(p))
      c.close()
    },
  })

async function collect<T>(it: AsyncIterable<T>) {
  const out: T[] = []
  for await (const x of it) out.push(x)
  return out
}

afterEach(() => vi.unstubAllGlobals())

test('parseSSE handles events split across reads and stops at [DONE]', async () => {
  const body = sse('data: {"choices":[{"delta":{"content":"A"}}]}\n\nda', 'ta: {"choices":[{"delta":{"content":"B"}}]}\n\n', 'data: [DONE]\n\ndata: {"ignored":true}\n\n')
  const out = await collect(parseSSE(body))
  expect(out.map((c) => c.choices?.[0].delta?.content)).toEqual(['A', 'B'])
})

test('withTiming measures speed when the server sends none', async () => {
  const times = [0, 1000, 3000] // start, first token, end (ms)
  const now = () => times.shift()!
  async function* src(): AsyncGenerator<StreamChunk> {
    yield { type: 'delta', text: 'hi' }
    yield { type: 'done', usage: { promptTokens: 50, completionTokens: 10 } }
  }
  const out = await collect(withTiming(src(), 'prompt', now))
  expect(out.at(-1)).toEqual({ type: 'done', usage: { promptTokens: 50, completionTokens: 10, prefillTps: 50, decodeTps: 5 } })
})

test('withTiming estimates tokens when usage is missing', async () => {
  async function* src(): AsyncGenerator<StreamChunk> {
    yield { type: 'delta', text: '12345678' }
    yield { type: 'done', usage: { promptTokens: 0, completionTokens: 0 } }
  }
  const out = await collect(withTiming(src(), 'abcd'))
  const done = out.at(-1) as Extract<StreamChunk, { type: 'done' }>
  expect(done.usage.promptTokens).toBe(1)
  expect(done.usage.completionTokens).toBe(2)
})

test('provider posts to baseURL/chat/completions with bearer key and streams text', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(sse('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', 'data: [DONE]\n\n')))
  vi.stubGlobal('fetch', fetchMock)
  const p = createOpenAIProvider({ baseURL: 'https://api.example.com/v1/', apiKey: 'sk-test', model: 'm', contextWindow: 8192 })
  const out = await collect(p.chat([{ role: 'user', content: 'hi' }]))

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('https://api.example.com/v1/chat/completions')
  expect(init.headers.Authorization).toBe('Bearer sk-test')
  expect(JSON.parse(init.body)).toMatchObject({ model: 'm', stream: true })
  expect(out[0]).toEqual({ type: 'delta', text: 'ok' })
  expect(out.at(-1)?.type).toBe('done')
})

test('provider surfaces HTTP errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad key', { status: 401 })))
  const p = createOpenAIProvider({ baseURL: 'https://x', apiKey: '', model: 'm', contextWindow: 1 })
  await expect(collect(p.chat([]))).rejects.toThrow('API error 401: bad key')
})
