import type { StreamChunk, Usage } from './types'

/** Minimal shape of an OpenAI chat.completions stream chunk (WebLLM emits the same). */
export type OpenAIChunk = {
  choices?: { delta?: { content?: string | null } }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    extra?: { prefill_tokens_per_s?: number; decode_tokens_per_s?: number }
  } | null
}

/** Turn an OpenAI-style chunk stream into our StreamChunk stream. Always ends with exactly one `done`. */
export async function* fromOpenAIChunks(chunks: AsyncIterable<OpenAIChunk>): AsyncGenerator<StreamChunk> {
  let usage: Usage = { promptTokens: 0, completionTokens: 0 }
  for await (const c of chunks) {
    const text = c.choices?.[0]?.delta?.content
    if (text) yield { type: 'delta', text }
    if (c.usage) {
      usage = {
        promptTokens: c.usage.prompt_tokens,
        completionTokens: c.usage.completion_tokens,
        prefillTps: c.usage.extra?.prefill_tokens_per_s,
        decodeTps: c.usage.extra?.decode_tokens_per_s,
      }
    }
  }
  yield { type: 'done', usage }
}
