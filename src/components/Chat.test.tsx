import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import Chat from './Chat'

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
