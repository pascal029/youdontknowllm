import { describe, expect, test, vi } from 'vitest'
import type { Message, Provider } from '../llm/types'
import type { Tool } from '../tools/types'
import { runAgent, type LoopEvent } from './loop'

/** Fake provider that replies with scripted outputs in order and records what it was sent. */
function fakeProvider(replies: string[]) {
  const calls: Message[][] = []
  const provider: Provider = {
    name: 'fake',
    contextWindow: 4096,
    async *chat(messages) {
      calls.push(messages)
      const text = replies.shift() ?? 'out of replies'
      for (const part of text.match(/.{1,5}/gs) ?? []) yield { type: 'delta', text: part }
      yield { type: 'done', usage: { promptTokens: 100, completionTokens: 10, decodeTps: 20 } }
    },
  }
  return { provider, calls }
}

const calculator: Tool = { name: 'calculator', description: 'math', parameters: { type: 'object' }, code: 'CODE', enabled: true }

async function drain(gen: AsyncGenerator<LoopEvent, Message[]>) {
  const events: LoopEvent[] = []
  for (;;) {
    const r = await gen.next()
    if (r.done) return { events, steps: events.filter((e) => e.type !== 'delta'), history: r.value }
    events.push(r.value)
  }
}

const base = { systemPrompt: 'Be brief.', history: [] as Message[], userText: 'What is 23*19?' }

test('direct answer: user → model → answer', async () => {
  const { provider } = fakeProvider(['It is 437.'])
  const { steps, history, events } = await drain(runAgent({ ...base, provider, tools: [calculator] }))
  expect(steps.map((s) => s.type)).toEqual(['user', 'model', 'answer'])
  expect(steps.at(-1)).toEqual({ type: 'answer', text: 'It is 437.' })
  expect(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join('')).toBe('It is 437.')
  expect(history).toEqual([{ role: 'user', content: 'What is 23*19?' }, { role: 'assistant', content: 'It is 437.' }])
})

test('tool round-trip: model calls tool → sandbox runs → result fed back → answer', async () => {
  const { provider, calls } = fakeProvider(['<tool_call>{"name":"calculator","arguments":{"expression":"23*19"}}</tool_call>', '23 × 19 = 437'])
  const run = vi.fn().mockResolvedValue({ ok: true, result: 437, logs: [], ms: 2 })
  const { steps, history } = await drain(runAgent({ ...base, provider, tools: [calculator], run }))

  expect(steps.map((s) => s.type)).toEqual(['user', 'model', 'tool-call', 'tool-result', 'model', 'answer'])
  expect(run).toHaveBeenCalledWith('CODE', { expression: '23*19' })
  expect(steps[2]).toEqual({ type: 'tool-call', name: 'calculator', arguments: { expression: '23*19' } })
  expect(steps[1]).toMatchObject({ type: 'model', iteration: 1, usage: { promptTokens: 100, completionTokens: 10 } })

  // second model call sees system prompt with tools + the tool response
  const second = calls[1]
  expect(second[0].role).toBe('system')
  expect(second[0].content).toContain('"name":"calculator"')
  expect(second.at(-1)).toEqual({ role: 'user', content: '<tool_response>{"name":"calculator","result":437}</tool_response>' })
  expect(history).toHaveLength(4)
})

test('unknown tool: error result is fed back so the model can recover', async () => {
  const { provider, calls } = fakeProvider(['<tool_call>{"name":"weather","arguments":{}}</tool_call>', 'Sorry, I cannot check weather.'])
  const run = vi.fn()
  const { steps } = await drain(runAgent({ ...base, provider, tools: [calculator], run }))
  expect(run).not.toHaveBeenCalled()
  expect(steps[3]).toMatchObject({ type: 'tool-result', name: 'weather', result: { ok: false, error: expect.stringContaining('Unknown tool "weather"') } })
  expect(calls[1].at(-1)?.content).toContain('"error":"Unknown tool')
  expect(steps.at(-1)?.type).toBe('answer')
})

test('tool failure is reported back to the model', async () => {
  const { provider, calls } = fakeProvider(['<tool_call>{"name":"calculator","arguments":{}}</tool_call>', 'Could not compute.'])
  const run = vi.fn().mockResolvedValue({ ok: false, error: 'Timed out after 3000ms (worker killed).', logs: [], ms: 3000 })
  await drain(runAgent({ ...base, provider, tools: [calculator], run }))
  expect(calls[1].at(-1)?.content).toContain('Timed out')
})

test('malformed call → parse-error step, model gets a correction and retries', async () => {
  const { provider, calls } = fakeProvider(['<tool_call>{bad json}</tool_call>', 'Fine, 437.'])
  const { steps } = await drain(runAgent({ ...base, provider, tools: [calculator] }))
  expect(steps.map((s) => s.type)).toEqual(['user', 'model', 'parse-error', 'model', 'answer'])
  expect(calls[1].at(-1)?.content).toMatch(/could not be parsed/)
})

test('stops after maxIterations', async () => {
  const loop = Array(5).fill('<tool_call>{"name":"calculator","arguments":{}}</tool_call>')
  const { provider, calls } = fakeProvider(loop)
  const run = vi.fn().mockResolvedValue({ ok: true, result: 1, logs: [], ms: 1 })
  const { steps } = await drain(runAgent({ ...base, provider, tools: [calculator], run, maxIterations: 3 }))
  expect(calls).toHaveLength(3)
  expect(steps.at(-1)).toEqual({ type: 'error', error: 'Stopped after 3 model calls without a final answer.' })
})

describe('system prompt', () => {
  test('no tools and empty prompt → no system message', async () => {
    const { provider, calls } = fakeProvider(['hi'])
    await drain(runAgent({ ...base, systemPrompt: '  ', provider, tools: [] }))
    expect(calls[0]).toEqual([{ role: 'user', content: 'What is 23*19?' }])
  })
  test('keeps previous history', async () => {
    const { provider, calls } = fakeProvider(['ok'])
    const history: Message[] = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]
    await drain(runAgent({ ...base, history, provider, tools: [] }))
    expect(calls[0].slice(1).map((m) => m.content)).toEqual(['a', 'b', 'What is 23*19?'])
  })
})

test('provider errors propagate (caller decides how to show them)', async () => {
  // oxlint-disable-next-line require-yield
  const provider: Provider = { name: 'x', contextWindow: 1, chat: async function* () { throw new Error('API error 500') } }
  await expect(drain(runAgent({ ...base, provider, tools: [] }))).rejects.toThrow('API error 500')
})
