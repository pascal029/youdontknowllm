import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SUMMARY_ACK, SUMMARY_PREFIX } from '../../agent/compact'
import { formatToolResponse } from '../../agent/prompt'
import type { Message } from '../../llm/types'
import ContextCompactor from './index'

const u = (content: string): Message => ({ role: 'user', content })
const a = (content: string): Message => ({ role: 'assistant', content })
const history: Message[] = [
  u('What is 2+2?'),
  a('<tool_call>{"name":"calculator","arguments":{"expression":"2+2"}}</tool_call>'),
  u(formatToolResponse('calculator', 4)),
  a('It is 4.'),
  u('My name is Ana.'),
  a('Hi Ana!'),
  u('Favourite colour?'),
  a('Green.'),
]
const base = { history, systemTokens: 100, contextWindow: 4096, local: false, summarize: vi.fn(), onApply: vi.fn(), onCancel: vi.fn() }
const after = () => screen.getByRole('region', { name: 'After' })
const before = () => screen.getByRole('region', { name: 'Before' })

test('drop oldest: before marks removed messages, after starts on a user turn, apply sends the new history', async () => {
  const onApply = vi.fn()
  render(<ContextCompactor {...base} onApply={onApply} />)
  // default N=4 → drops the whole first (tool) turn
  expect(within(before()).getAllByText('(removed)')).toHaveLength(4)
  expect(within(after()).getAllByRole('listitem')).toHaveLength(1 + 4) // system row + 4 kept
  expect(screen.getByText(/≈\d+ → ≈\d+ tokens/)).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText(/Messages to drop/), { target: { value: '6' } })
  expect(within(before()).getAllByText('(removed)')).toHaveLength(6)

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(onApply).toHaveBeenCalledWith(history.slice(6), 'dropped oldest 6')
})

test('remove tool traffic keeps questions and answers', async () => {
  const onApply = vi.fn()
  render(<ContextCompactor {...base} onApply={onApply} />)
  await userEvent.click(screen.getByRole('radio', { name: /Remove tool traffic/ }))
  expect(within(before()).getByText('tool call')).toBeInTheDocument()
  expect(within(after()).queryByText('tool call')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(onApply.mock.calls[0][0]).toHaveLength(6)
})

test('nothing to remove → Apply disabled', async () => {
  render(<ContextCompactor {...base} history={[u('hi'), a('hello')]} />)
  await userEvent.click(screen.getByRole('radio', { name: /Remove tool traffic/ }))
  expect(screen.getByText(/nothing to remove/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
})

test('summary: needs a preview first, then shows the new summary turn and applies it', async () => {
  const summarized = [u(`${SUMMARY_PREFIX}\n- 2+2 = 4, user is Ana`), a(SUMMARY_ACK), ...history.slice(6)]
  const summarize = vi.fn().mockResolvedValue({ history: summarized, summary: '- 2+2 = 4', usage: { promptTokens: 80, completionTokens: 12 } })
  const onApply = vi.fn()
  render(<ContextCompactor {...base} summarize={summarize} onApply={onApply} />)

  await userEvent.click(screen.getByRole('radio', { name: /Summary \+ keep last N/ }))
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Generate preview' }))

  expect(summarize).toHaveBeenCalledWith(history, 4, expect.any(AbortSignal))
  expect(await within(after()).findAllByText('(new)')).toHaveLength(2)
  expect(screen.getByText(/summary call itself used 92 tokens/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(onApply).toHaveBeenCalledWith(summarized, 'summary + last 4')
})

test('summary errors are shown', async () => {
  render(<ContextCompactor {...base} summarize={vi.fn().mockRejectedValue(new Error('API error 429'))} />)
  await userEvent.click(screen.getByRole('radio', { name: /Summarize everything/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Generate preview' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('API error 429')
})

test('in-browser model: hint only on the summarize strategies', async () => {
  render(<ContextCompactor {...base} local />)
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: /Summarize everything/ }))
  expect(screen.getByRole('note')).toHaveTextContent(/Small in-browser models/)
})

test('API model: no small-model hint', async () => {
  render(<ContextCompactor {...base} />)
  await userEvent.click(screen.getByRole('radio', { name: /Summarize everything/ }))
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
})
