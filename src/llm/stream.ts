import type { StreamChunk, Usage } from './types'

/** Minimal shape of an OpenAI chat.completions stream chunk (WebLLM emits the same). */
export type OpenAIChunk = {
  choices?: { delta?: { content?: string | null; reasoning?: string | null; reasoning_content?: string | null } }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    extra?: { prefill_tokens_per_s?: number; decode_tokens_per_s?: number }
  } | null
}

/**
 * Turn an OpenAI-style chunk stream into our StreamChunk stream. Always ends with exactly one `done`.
 * Reasoning models (Ollama `reasoning`, DeepSeek/vLLM `reasoning_content`) stream thinking in a separate
 * field; we inline it as <think>…</think> so learners see it and timing starts at the real first token.
 */
export async function* fromOpenAIChunks(chunks: AsyncIterable<OpenAIChunk>): AsyncGenerator<StreamChunk> {
  let usage: Usage = { promptTokens: 0, completionTokens: 0 }
  let thinking = false
  for await (const c of chunks) {
    const delta = c.choices?.[0]?.delta
    const reasoning = delta?.reasoning || delta?.reasoning_content
    const text = delta?.content
    if (reasoning) {
      yield { type: 'delta', text: thinking ? reasoning : `<think>${reasoning}` }
      thinking = true
    }
    if (text) {
      if (thinking) {
        yield { type: 'delta', text: '</think>\n' }
        thinking = false
      }
      yield { type: 'delta', text }
    }
    if (c.usage) {
      usage = {
        promptTokens: c.usage.prompt_tokens,
        completionTokens: c.usage.completion_tokens,
        prefillTps: c.usage.extra?.prefill_tokens_per_s,
        decodeTps: c.usage.extra?.decode_tokens_per_s,
      }
    }
  }
  if (thinking) yield { type: 'delta', text: '</think>' }
  yield { type: 'done', usage }
}
