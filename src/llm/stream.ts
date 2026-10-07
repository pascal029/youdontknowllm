import type { StreamChunk, Usage } from './types'

/** Minimal shape of an OpenAI chat.completions stream chunk (WebLLM emits the same). */
export type OpenAIChunk = {
  choices?: {
    delta?: {
      content?: string | null
      reasoning?: string | null
      reasoning_content?: string | null
      tool_calls?: { index?: number; function?: { name?: string; arguments?: string } }[]
    }
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    extra?: { prefill_tokens_per_s?: number; decode_tokens_per_s?: number }
  } | null
  /** some servers report failures inside the stream instead of with an HTTP status */
  error?: { message?: string; code?: string; failed_generation?: string }
}

/**
 * Groq (and other gpt-oss hosts) abort with `tool_use_failed` when the model makes a native tool call
 * but the request had no `tools` list, which is how this app works (tools live in the prompt). The
 * error carries the call the model made, so we recover it as a normal tool call.
 */
function recoveredToolCall(err: NonNullable<OpenAIChunk['error']>): string | null {
  if (err.code !== 'tool_use_failed' || !err.failed_generation) return null
  try {
    const call = JSON.parse(err.failed_generation) as { name?: unknown }
    return typeof call?.name === 'string' ? `<tool_call>${err.failed_generation}</tool_call>` : null
  } catch {
    return null
  }
}

/**
 * Turn an OpenAI-style chunk stream into our StreamChunk stream. Always ends with exactly one `done`.
 * Reasoning models (Ollama `reasoning`, DeepSeek/vLLM `reasoning_content`) stream thinking in a separate
 * field; we inline it as <think>…</think> so learners see it and timing starts at the real first token.
 * Some servers return native `tool_calls` even though we only describe tools in the prompt (Ollama does this
 * for gpt-oss). Their pieces are collected and emitted as our `<tool_call>{…}</tool_call>` text at the end,
 * so the rest of the app handles every model the same way.
 */
export async function* fromOpenAIChunks(chunks: AsyncIterable<OpenAIChunk>): AsyncGenerator<StreamChunk> {
  let usage: Usage = { promptTokens: 0, completionTokens: 0 }
  let thinking = false
  const calls: { name: string; args: string }[] = []
  for await (const c of chunks) {
    if (c.error) {
      const call = recoveredToolCall(c.error)
      if (!call) throw new Error(`API error: ${c.error.message ?? JSON.stringify(c.error)}`)
      if (thinking) yield { type: 'delta', text: '</think>' }
      thinking = false
      yield { type: 'delta', text: call }
      break // the server ends the stream after this error
    }
    const delta = c.choices?.[0]?.delta
    for (const tc of delta?.tool_calls ?? []) {
      const call = (calls[tc.index ?? calls.length] ??= { name: '', args: '' })
      call.name += tc.function?.name ?? ''
      call.args += tc.function?.arguments ?? ''
    }
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
  for (const call of calls.filter(Boolean)) {
    // arguments stay a JSON string; parseToolCall decodes double-encoded arguments
    yield { type: 'delta', text: `<tool_call>${JSON.stringify({ name: call.name, arguments: call.args || '{}' })}</tool_call>` }
  }
  yield { type: 'done', usage }
}
