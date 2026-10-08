import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import Chat from './index'

const base = { messages: [], busy: false, onSend: () => {}, onStop: () => {} }

test('sends trimmed text on Enter and clears the box', async () => {
  const onSend = vi.fn()
  render(<Chat {...base} onSend={onSend} />)
  const box = screen.getByLabelText('Message')
  await userEvent.type(box, '  hello  {Enter}')
  expect(onSend).toHaveBeenCalledWith('hello')
  expect(box).toHaveValue('')
})

test('Shift+Enter adds a newline instead of sending', async () => {
  const onSend = vi.fn()
  render(<Chat {...base} onSend={onSend} />)
  await userEvent.type(screen.getByLabelText('Message'), 'a{Shift>}{Enter}{/Shift}b')
  expect(onSend).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Message')).toHaveValue('a\nb')
})

test('hides system messages, shows streaming text and a Stop button while busy', async () => {
  const onStop = vi.fn()
  render(<Chat {...base} busy streaming="Thinking" onStop={onStop} messages={[{ role: 'system', content: 'SECRET' }, { role: 'user', content: 'hi' }]} />)
  expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
  expect(screen.getByText('hi')).toBeInTheDocument()
  expect(screen.getByText('Thinking')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(onStop).toHaveBeenCalled()
})

test('disabled shows the reason and blocks sending', () => {
  render(<Chat {...base} disabled disabledReason="Load a model first" />)
  expect(screen.getByLabelText('Message')).toBeDisabled()
  expect(screen.getByText('Load a model first')).toBeInTheDocument()
})

test('New chat appears only when there are messages', async () => {
  const onClear = vi.fn()
  const { rerender } = render(<Chat {...base} onClear={onClear} />)
  expect(screen.queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument()
  rerender(<Chat {...base} onClear={onClear} messages={[{ role: 'user', content: 'hi' }]} />)
  await userEvent.click(screen.getByRole('button', { name: 'New chat' }))
  expect(onClear).toHaveBeenCalled()
})

test('an answer keeps its thinking in a collapsed, expandable section', async () => {
  render(<Chat {...base} messages={[{ role: 'assistant', content: '437', thinking: '23*19 = 437' }]} />)
  const details = screen.getByText('Thought process').closest('details')!
  expect(details).not.toHaveAttribute('open')
  await userEvent.click(screen.getByText('Thought process'))
  expect(details).toHaveAttribute('open')
  expect(screen.getByText('23*19 = 437')).toBeInTheDocument()
})

test('while the model is thinking the section is open; once it answers it collapses', () => {
  const { rerender } = render(<Chat {...base} busy streaming="<think>let me see" />)
  expect(screen.getByText('Thinking…').closest('details')).toHaveAttribute('open')
  rerender(<Chat {...base} busy streaming="<think>let me see</think>It is" />)
  expect(screen.getByText('Thought process').closest('details')).not.toHaveAttribute('open')
  expect(screen.getByText('It is')).toBeInTheDocument()
})
