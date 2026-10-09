import { resolveBaseURL } from './relay'
import { fromOpenAIChunks, type OpenAIChunk } from './stream'
import type { Message, Provider, Sampling, StreamChunk } from './types'

export type RemoteConfig = {
  baseURL: string
  apiKey: string
  model: string
  contextWindow: number
}

/** Parse a `text/event-stream` body into JSON chunks. Stops at `data: [DONE]`. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<OpenAIChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()!
    for (const line of lines) {
      const data = line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!data) continue
      if (data === '[DONE]') return
      yield JSON.parse(data)
    }
  }
}

const estimateTokens = (s: string) => Math.ceil(s.length / 4) // ponytail: rough chars/4, servers usually send real usage

/**
 * Fill in usage + speed the server didn't send, measured on our side:
 * prefill ≈ prompt tokens / time-to-first-token, decode ≈ output tokens / generation time.
 */
export async function* withTiming(
  stream: AsyncIterable<StreamChunk>,
  promptText: string,
  /** when the request was sent (before fetch), so time-to-first-token includes the server's prefill */
  start: number,
  now: () => number = () => performance.now(),
): AsyncGenerator<StreamChunk> {
  let first = 0
  let out = ''
  for await (const c of stream) {
    if (c.type === 'delta') {
      if (!first) first = now()
      out += c.text
      yield c
      continue
    }
    const end = now()
    const promptTokens = c.usage.promptTokens || estimateTokens(promptText)
    const completionTokens = c.usage.completionTokens || estimateTokens(out)
    const ttft = ((first || end) - start) / 1000
    const gen = (end - (first || end)) / 1000
    yield {
      type: 'done',
      usage: {
        promptTokens,
        completionTokens,
        prefillTps: c.usage.prefillTps ?? (ttft > 0 ? promptTokens / ttft : undefined),
        decodeTps: c.usage.decodeTps ?? (gen > 0 ? completionTokens / gen : undefined),
      },
    }
  }
}

/** fetch() only says "Failed to fetch"; explain the usual causes instead. */
export function networkErrorMessage(baseURL: string, err: unknown): string {
  let host = baseURL
  try {
    host = new URL(baseURL).host
  } catch {
    /* keep raw */
  }
  return `Couldn't reach ${host} (${err instanceof Error ? err.message : String(err)}). Check the base URL and that the server is running. If it works with curl but not here, the server is blocking browser requests (CORS).`
}

export function createOpenAIProvider(cfg: RemoteConfig): Provider {
  const url = resolveBaseURL(cfg.baseURL).url + '/chat/completions'
  return {
    name: cfg.model,
    contextWindow: cfg.contextWindow,
    async *chat(messages: Message[], signal?: AbortSignal, sampling?: Sampling) {
      const start = performance.now()
      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          ...sampling,
          stream: true,
          stream_options: { include_usage: true },
        }),
      }).catch((e: unknown) => {
        if (signal?.aborted) throw e
        throw new Error(networkErrorMessage(cfg.baseURL, e))
      })
      if (!res.ok || !res.body) throw new Error(`API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
      yield* withTiming(fromOpenAIChunks(parseSSE(res.body)), messages.map((m) => m.content).join('\n'), start)
    },
  }
}
