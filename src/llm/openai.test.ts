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
  const times = [1000, 3000] // first token, end (ms); request sent at 0
  const now = () => times.shift()!
  async function* src(): AsyncGenerator<StreamChunk> {
    yield { type: 'delta', text: 'hi' }
    yield { type: 'done', usage: { promptTokens: 50, completionTokens: 10 } }
  }
  const out = await collect(withTiming(src(), 'prompt', 0, now))
  expect(out.at(-1)).toEqual({ type: 'done', usage: { promptTokens: 50, completionTokens: 10, prefillTps: 50, decodeTps: 5 } })
})

test('withTiming estimates tokens when usage is missing', async () => {
  async function* src(): AsyncGenerator<StreamChunk> {
    yield { type: 'delta', text: '12345678' }
    yield { type: 'done', usage: { promptTokens: 0, completionTokens: 0 } }
  }
  const out = await collect(withTiming(src(), 'abcd', performance.now()))
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

test('ollama.com is called through the site relay; other hosts directly', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(sse('data: [DONE]\n\n')))
  vi.stubGlobal('fetch', fetchMock)
  await collect(createOpenAIProvider({ baseURL: 'https://ollama.com/v1', apiKey: 'k', model: 'gpt-oss:20b', contextWindow: 1 }).chat([]))
  expect(fetchMock.mock.calls[0][0]).toBe(`${location.origin}/relay/ollama/v1/chat/completions`)
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer k')
})

test('sends only the sampling keys that are set', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(sse('data: [DONE]\n\n')))
  vi.stubGlobal('fetch', fetchMock)
  const p = createOpenAIProvider({ baseURL: 'https://api.example.com/v1', apiKey: '', model: 'm', contextWindow: 8192 })
  await collect(p.chat([], undefined, { temperature: 0, seed: 7, top_p: undefined }))
  await collect(p.chat([]))

  const withSampling = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(withSampling).toMatchObject({ temperature: 0, seed: 7, stream: true })
  expect('top_p' in withSampling).toBe(false)
  expect(Object.keys(JSON.parse(fetchMock.mock.calls[1][1].body)).sort()).toEqual(['messages', 'model', 'stream', 'stream_options'])
})

test('network failures explain the likely cause instead of "Failed to fetch"', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  const p = createOpenAIProvider({ baseURL: 'https://api.example.com/v1', apiKey: '', model: 'm', contextWindow: 1 })
  await expect(collect(p.chat([]))).rejects.toThrow(/Couldn't reach api\.example\.com \(Failed to fetch\).*CORS/)
})

test('abort is passed through untouched', async () => {
  const ac = new AbortController()
  ac.abort()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')))
  const p = createOpenAIProvider({ baseURL: 'https://api.example.com/v1', apiKey: '', model: 'm', contextWindow: 1 })
  await expect(collect(p.chat([], ac.signal))).rejects.toThrow('aborted')
})
