import { expect, test } from 'vitest'
import type { Message, Provider, Sampling } from '../llm/types'
import { dropOldest, historyTokens, isToolTraffic, stripToolTraffic, summarize, SUMMARY_ACK, SUMMARY_PREFIX } from './compact'
import { formatParseError, formatToolResponse } from './prompt'

const u = (content: string): Message => ({ role: 'user', content })
const a = (content: string): Message => ({ role: 'assistant', content })
const call = a('<tool_call>{"name":"calculator","arguments":{"expression":"2+2"}}</tool_call>')
const result = u(formatToolResponse('calculator', 4))

// turn 1 uses a tool, turn 2 and 3 are plain
const history: Message[] = [u('What is 2+2?'), call, result, a('It is 4.'), u('My name is Ana.'), a('Hi Ana!'), u('Favourite colour?'), a('Green.')]

test('recognises tool calls, tool results and parse-error retries as tool traffic', () => {
  expect([call, result, u(formatParseError('bad JSON'))].every(isToolTraffic)).toBe(true)
  expect([u('hi'), a('hello'), a('<think>use a tool?</think>No need.')].some(isToolTraffic)).toBe(false)
})

test('dropOldest never leaves the history starting mid-turn', () => {
  expect(dropOldest(history, 0)).toEqual(history)
  // cutting after the question would start on the tool call → skips to the next user turn
  expect(dropOldest(history, 1)).toEqual(history.slice(4))
  expect(dropOldest(history, 4)).toEqual(history.slice(4))
  expect(dropOldest(history, 5)).toEqual(history.slice(6))
  expect(dropOldest(history, 99)).toEqual([])
})

test('stripToolTraffic keeps questions and answers only', () => {
  expect(stripToolTraffic(history)).toEqual([u('What is 2+2?'), a('It is 4.'), ...history.slice(4)])
})

test('historyTokens is a rough chars/4 sum', () => {
  expect(historyTokens([u('abcd'), a('abcdefgh')])).toBe(3)
})

function fakeProvider(reply: string) {
  const sent: { messages: Message[]; sampling?: Sampling }[] = []
  const provider: Provider = {
    name: 'fake',
    contextWindow: 4096,
    async *chat(messages, _signal, sampling) {
      sent.push({ messages, sampling })
      yield { type: 'delta', text: reply }
      yield { type: 'done', usage: { promptTokens: 50, completionTokens: 9 } }
    },
  }
  return { provider, sent }
}

test('summarize everything → one summary turn, thinking stripped, transcript sent', async () => {
  const { provider, sent } = fakeProvider('<think>hmm</think>- 2+2 = 4\n- User is Ana, likes green')
  const r = await summarize(provider, history, { sampling: { temperature: 0 } })

  expect(r.history).toEqual([u(`${SUMMARY_PREFIX}\n- 2+2 = 4\n- User is Ana, likes green`), a(SUMMARY_ACK)])
  expect(r.usage?.promptTokens).toBe(50)
  const prompt = sent[0].messages.at(-1)!.content
  expect(prompt).toContain('User: What is 2+2?')
  expect(prompt).toContain('Tool result: <tool_response>')
  expect(prompt).toContain('Assistant: Green.')
  expect(sent[0].sampling).toEqual({ temperature: 0 })
})

test('summary + keep last N keeps a tail that starts on a user turn', async () => {
  const { provider, sent } = fakeProvider('- 2+2 = 4')
  // the last 3 would start on "Hi Ana!" → backs up to the user turn before it, so 4 are kept
  const r = await summarize(provider, history, { keepLast: 3 })
  expect(r.history.slice(2)).toEqual(history.slice(4))
  expect(sent[0].messages.at(-1)!.content).not.toContain('Ana')
})

test('nothing to summarize → unchanged, no model call; empty summary → error', async () => {
  const { provider, sent } = fakeProvider('x')
  expect((await summarize(provider, history.slice(4), { keepLast: 4 })).history).toEqual(history.slice(4))
  expect(sent).toHaveLength(0)
  await expect(summarize(fakeProvider('<think>only thinking</think>').provider, history)).rejects.toThrow(/empty summary/)
})
