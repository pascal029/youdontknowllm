// Context compaction: shrink the history the model re-reads every turn. The chat the user sees is not touched.
import { estimateTokens } from '../llm/openai'
import type { Message, Provider, Sampling, Usage } from '../llm/types'
import { parseToolCall, splitThink } from './parseToolCall'
import { PARSE_ERROR_PREFIX } from './prompt'

export { estimateTokens }

export const historyTokens = (h: Message[]) => h.reduce((n, m) => n + estimateTokens(m.content), 0)

/** Tool calls, tool results and parse-error retries: the plumbing between a question and its answer. */
export function isToolTraffic(m: Message): boolean {
  if (m.role === 'user') return m.content.startsWith('<tool_response>') || m.content.startsWith(PARSE_ERROR_PREFIX)
  return m.role === 'assistant' && parseToolCall(m.content).kind !== 'answer'
}

const isUserTurn = (m: Message) => m.role === 'user' && !isToolTraffic(m)

/** Sliding window: forget the first n messages, then keep cutting until the history starts with a real user message. */
export function dropOldest(history: Message[], n: number): Message[] {
  let i = Math.max(0, n)
  while (i < history.length && !isUserTurn(history[i])) i++
  return history.slice(i)
}

/** Keep questions and final answers, drop the tool round-trips in between. */
export const stripToolTraffic = (history: Message[]): Message[] => history.filter((m) => !isToolTraffic(m))

export const SUMMARY_PREFIX = 'Summary of our conversation so far:'
export const SUMMARY_ACK = 'Understood. I will continue from this summary.'

const SUMMARY_PROMPT =
  'You summarize conversations so they can be continued later. Keep every fact, name, number, decision and open question. ' +
  'Write short bullet points. Do not add anything that is not in the conversation. Output only the summary.'

/** Where the kept tail starts: at least `keepLast` messages, beginning on a user turn. 0 = summarize everything. */
function splitPoint(history: Message[], keepLast: number): number {
  if (keepLast <= 0) return history.length
  let i = history.length - keepLast
  while (i > 0 && !isUserTurn(history[i])) i--
  return Math.max(0, i)
}

const speaker = (m: Message) => (m.role === 'assistant' ? 'Assistant' : m.content.startsWith('<tool_response>') ? 'Tool result' : 'User')

/** Plain "User: … / Assistant: …" text, thinking removed: easier for a small model than a raw message list. */
const transcript = (h: Message[]) =>
  h
    .map((m) => ({ who: speaker(m), text: splitThink(m.content).text }))
    .filter((t) => t.text)
    .map((t) => `${t.who}: ${t.text}`)
    .join('\n\n')

export type SummaryResult = { history: Message[]; summary: string; usage?: Usage }

/**
 * Ask the model to summarize the older part of the history and replace it with one summary turn
 * (user summary + short assistant ack, so roles keep alternating for strict chat templates).
 */
export async function summarize(
  provider: Provider,
  history: Message[],
  o: { keepLast?: number; sampling?: Sampling; signal?: AbortSignal } = {},
): Promise<SummaryResult> {
  const cut = splitPoint(history, o.keepLast ?? 0)
  const older = history.slice(0, cut)
  if (!older.length) return { history, summary: '' }

  let raw = ''
  let usage: Usage | undefined
  const messages: Message[] = [
    { role: 'system', content: SUMMARY_PROMPT },
    { role: 'user', content: `Summarize this conversation:\n\n${transcript(older)}` },
  ]
  for await (const c of provider.chat(messages, o.signal, o.sampling)) {
    if (c.type === 'delta') raw += c.text
    else usage = c.usage
  }
  const summary = splitThink(raw).text.trim()
  if (!summary) throw new Error('The model returned an empty summary. Try again, or use a strategy that does not need the model.')
  return {
    history: [{ role: 'user', content: `${SUMMARY_PREFIX}\n${summary}` }, { role: 'assistant', content: SUMMARY_ACK }, ...history.slice(cut)],
    summary,
    usage,
  }
}
