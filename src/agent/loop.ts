import type { Message, Provider, Sampling, Usage } from '../llm/types'
import { runInSandbox, type SandboxResult } from '../tools/sandbox'
import type { Tool } from '../tools/types'
import { parseToolCall } from './parseToolCall'
import { composeSystemPrompt, formatParseError, formatToolResponse } from './prompt'

/** One visible step of the agent loop. The UI renders a list of these. */
export type Step =
  | { type: 'user'; text: string }
  | { type: 'model'; iteration: number; text: string; usage: Usage; ms: number }
  | { type: 'tool-call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool-result'; name: string; result: SandboxResult }
  | { type: 'parse-error'; error: string; raw: string }
  | { type: 'answer'; text: string }
  | { type: 'error'; error: string }

/** Steps plus live token deltas (not stored, only for streaming display). */
export type LoopEvent = Step | { type: 'delta'; text: string }

export type RunOptions = {
  provider: Provider
  systemPrompt: string
  /** enabled tools only */
  tools: Tool[]
  /** previous conversation (no system message) */
  history: Message[]
  userText: string
  signal?: AbortSignal
  sampling?: Sampling
  maxIterations?: number
  run?: (code: string, args: unknown) => Promise<SandboxResult>
}

/**
 * The agent loop: ask the model → if it calls a tool, run it in the sandbox, feed the result back → repeat
 * until it answers (or maxIterations). Returns the full new history to keep as model context.
 */
export async function* runAgent(o: RunOptions): AsyncGenerator<LoopEvent, Message[]> {
  const { provider, tools, signal, maxIterations = 5, run = runInSandbox } = o
  const system = composeSystemPrompt(o.systemPrompt.trim(), tools)
  const history: Message[] = [...o.history, { role: 'user', content: o.userText }]
  yield { type: 'user', text: o.userText }

  for (let i = 1; i <= maxIterations; i++) {
    const start = performance.now()
    let raw = ''
    let usage: Usage = { promptTokens: 0, completionTokens: 0 }
    const messages: Message[] = system ? [{ role: 'system', content: system }, ...history] : [...history]
    for await (const c of provider.chat(messages, signal, o.sampling)) {
      if (c.type === 'delta') {
        raw += c.text
        yield { type: 'delta', text: c.text }
      } else usage = c.usage
    }
    yield { type: 'model', iteration: i, text: raw, usage, ms: Math.round(performance.now() - start) }
    history.push({ role: 'assistant', content: raw })

    const parsed = parseToolCall(raw)
    if (parsed.kind === 'answer') {
      yield { type: 'answer', text: parsed.text }
      return history
    }
    if (parsed.kind === 'error') {
      yield { type: 'parse-error', error: parsed.error, raw: parsed.raw }
      history.push({ role: 'user', content: formatParseError(parsed.error) })
      continue
    }

    yield { type: 'tool-call', name: parsed.name, arguments: parsed.arguments }
    const tool = tools.find((t) => t.name === parsed.name)
    const result: SandboxResult = tool
      ? await run(tool.code, parsed.arguments)
      : { ok: false, error: `Unknown tool "${parsed.name}". Available: ${tools.map((t) => t.name).join(', ') || 'none'}.`, logs: [], ms: 0 }
    yield { type: 'tool-result', name: parsed.name, result }
    history.push({ role: 'user', content: formatToolResponse(parsed.name, result.ok ? result.result : { error: result.error }) })
  }

  yield { type: 'error', error: `Stopped after ${maxIterations} model calls without a final answer.` }
  return history
}
