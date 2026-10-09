import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { installFakeWorker } from './test-fake-worker'

const sse = (...events: object[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`))
      c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      c.close()
    },
  })

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

test('chat is disabled until a provider is ready', () => {
  render(<App />)
  expect(screen.getByLabelText('Message')).toBeDisabled()
})

test('end to end: connect OpenAI-compatible API, send, see streamed reply', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(sse({ choices: [{ delta: { content: 'Hello' } }] }, { choices: [{ delta: { content: ' there' } }] })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)

  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}')

  expect(await within(screen.getByRole('main')).findByText('Hello there')).toBeInTheDocument()
  // no usage from server → estimated, but the meter is live against the configured 8192 window
  expect(Number(screen.getByLabelText('Context window used').getAttribute('value'))).toBeGreaterThan(0)
  expect(screen.getByText(/\/ 8,192 tokens/)).toBeInTheDocument()
  expect(screen.getByLabelText('Inference speed')).toBeInTheDocument()
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages
  expect(sent[0].role).toBe('system')
  expect(sent.at(-1)).toEqual({ role: 'user', content: 'hi' })
})

test('sends the saved sampling settings with each request', async () => {
  localStorage.setItem('ydkl.sampling', JSON.stringify({ temperature: 0.3, seed: 1 }))
  const fetchMock = vi.fn().mockImplementation(async () => new Response(sse({ choices: [{ delta: { content: 'ok' } }] })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}')
  await within(screen.getByRole('main')).findByText('ok')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ temperature: 0.3, seed: 1 })
})

test('compacting drops turns from what the model sees, but the chat keeps them', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(sse({ choices: [{ delta: { content: 'ok' } }] })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  const main = within(screen.getByRole('main'))
  for (const q of ['first', 'second', 'third']) {
    await userEvent.type(screen.getByLabelText('Message'), `${q}{Enter}`)
    await main.findByText(q)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Compact context…' })).toBeEnabled())
  }

  await userEvent.click(screen.getByRole('button', { name: 'Compact context…' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText(/Messages to drop/), { target: { value: '2' } })
  await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))

  expect(main.getByRole('note')).toHaveTextContent(/Context compacted \(dropped oldest 2\)/)
  expect(main.getByText('first')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Message'), 'fourth{Enter}')
  await main.findByText('fourth')
  const sent = JSON.parse(fetchMock.mock.calls.at(-1)![1].body).messages.map((m: { content: string }) => m.content)
  expect(sent).not.toContain('first')
  expect(sent).toContain('second')
})

test('Fill context adds a sample chat near the limit; the next request carries it', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(sse({ choices: [{ delta: { content: 'Your name is Ana.' } }] })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.click(screen.getByRole('button', { name: 'Fill context' }))

  const main = within(screen.getByRole('main'))
  expect(main.getByRole('note')).toHaveTextContent(/Added a sample conversation/)
  expect(main.getByText(/My name is Ana/)).toBeInTheDocument()
  const pct = Number(screen.getByLabelText('Context window used').getAttribute('value')) / 8192
  expect(pct).toBeGreaterThan(0.75)
  expect(pct).toBeLessThanOrEqual(0.8)
  expect(screen.getByRole('button', { name: 'Compact context…' })).toBeEnabled()

  await userEvent.type(screen.getByLabelText('Message'), 'what is my name?{Enter}')
  await main.findByText('Your name is Ana.')
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages
  expect(sent.some((m: { content: string }) => m.content.startsWith('<tool_response>'))).toBe(true)
})

test('shows API errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('API error 500')
})

test('disabling a tool removes it from the composed prompt', async () => {
  render(<App />)
  expect(screen.getByText(/"name":"calculator"/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: /calculator/ }))
  expect(screen.queryByText(/"name":"calculator"/)).not.toBeInTheDocument()
})

test('a local model without tool support gets no tools, and the UI says so', async () => {
  localStorage.setItem('ydkl.provider', JSON.stringify({ mode: 'local', localModelId: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC' }))
  render(<App />)
  expect(screen.getByText(/can't call tools reliably/)).toBeInTheDocument()
  expect(screen.getByText('off for this model')).toBeInTheDocument()
  expect(screen.queryByText(/"name":"calculator"/)).not.toBeInTheDocument()
})

test('add, persist, edit and delete a custom tool (editor and confirm in modals)', async () => {
  const { unmount } = render(<App />)
  await userEvent.click(screen.getByRole('button', { name: '+ Add tool' }))
  const add = screen.getByRole('dialog', { name: 'Add tool' })
  await userEvent.click(within(add).getByRole('button', { name: 'Save tool' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /reverse_text/ })).toBeChecked()
  expect(screen.getByText(/"name":"reverse_text"/)).toBeInTheDocument()
  unmount()

  render(<App />) // survives reload
  await userEvent.click(screen.getByRole('button', { name: 'Edit reverse_text' }))
  const edit = screen.getByRole('dialog', { name: 'Edit reverse_text' })
  const desc = within(edit).getByLabelText('Description')
  await userEvent.clear(desc)
  await userEvent.type(desc, 'Flip text')
  await userEvent.click(within(edit).getByRole('button', { name: 'Save tool' }))
  expect(screen.getByText('Flip text')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete reverse_text' }))
  const confirm = screen.getByRole('dialog', { name: 'Delete reverse_text?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('checkbox', { name: /reverse_text/ })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete reverse_text' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete tool' }))
  expect(screen.queryByRole('checkbox', { name: /reverse_text/ })).not.toBeInTheDocument()
})

test('end to end with a tool: model calls calculator, sandbox runs it, model answers', async () => {
  installFakeWorker()
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(sse({ choices: [{ delta: { content: '<tool_call>{"name":"calculator","arguments":{"expression":"23*19"}}</tool_call>' } }] })))
    .mockResolvedValueOnce(new Response(sse({ choices: [{ delta: { content: '23 × 19 = 437' } }] })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.type(screen.getByLabelText('Message'), 'what is 23*19?{Enter}')

  expect(await within(screen.getByRole('main')).findByText('23 × 19 = 437')).toBeInTheDocument()
  const second = JSON.parse(fetchMock.mock.calls[1][1].body).messages
  expect(second.at(-1).content).toBe('<tool_response>{"name":"calculator","result":437}</tool_response>')
  // the raw tool call is not a chat bubble, but the timeline shows every step
  expect(within(screen.getByRole('main')).queryByText(/"expression":"23\*19"/)).not.toBeInTheDocument()
  const steps = within(screen.getByRole('list', { name: 'Agent steps' })).getAllByRole('listitem')
  expect(steps.map((li) => li.querySelector('.step__title')?.textContent)).toEqual([
    'You asked', 'Model call #1', 'Model chose tool: calculator', 'calculator returned', 'Model call #2', 'Final answer',
  ])
})

test('New chat clears messages, steps and context, and the model starts fresh', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(sse({ choices: [{ delta: { content: 'Hello' } }] })))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.type(screen.getByLabelText('Message'), 'first{Enter}')
  await within(screen.getByRole('main')).findByText('Hello')

  await userEvent.click(screen.getByRole('button', { name: 'New chat' }))
  expect(within(screen.getByRole('main')).queryByText('first')).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Agent steps' })).not.toBeInTheDocument()
  expect(screen.getByText(/^0 \/ 8,192 tokens/)).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Message'), 'second{Enter}')
  await within(screen.getByRole('main')).findByText('Hello')
  const sent = JSON.parse(fetchMock.mock.calls[1][1].body).messages
  expect(sent.map((m: { content: string }) => m.content)).not.toContain('first')
})

test('view a built-in tool read-only, then duplicate it into an editable custom tool', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: 'View calculator code' }))
  const view = screen.getByRole('dialog', { name: 'calculator (built-in)' })
  expect(within(view).getByLabelText('Code')).toHaveAttribute('readonly')

  await userEvent.click(within(view).getByRole('button', { name: 'Duplicate & edit' }))
  const add = screen.getByRole('dialog', { name: 'Add tool' })
  expect(within(add).getByLabelText('Name')).toHaveValue('calculator_copy')
  expect(within(add).getByLabelText('Code')).not.toHaveAttribute('readonly')
  await userEvent.click(within(add).getByRole('button', { name: 'Save tool' }))

  expect(screen.getByRole('checkbox', { name: /calculator_copy/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /^calculator$/ })).toBeInTheDocument() // built-in untouched
})
