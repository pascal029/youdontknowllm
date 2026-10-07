import { render, screen } from '@testing-library/react'
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

  expect(await screen.findByText('Hello there')).toBeInTheDocument()
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages
  expect(sent[0].role).toBe('system')
  expect(sent.at(-1)).toEqual({ role: 'user', content: 'hi' })
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

test('add, persist, edit and delete a custom tool', async () => {
  const { unmount } = render(<App />)
  await userEvent.click(screen.getByRole('button', { name: '+ Add tool' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save tool' }))
  expect(screen.getByRole('checkbox', { name: /reverse_text/ })).toBeChecked()
  expect(screen.getByText(/"name":"reverse_text"/)).toBeInTheDocument()
  unmount()

  render(<App />) // survives reload
  await userEvent.click(screen.getByRole('button', { name: 'Edit reverse_text' }))
  const desc = screen.getByLabelText('Description')
  await userEvent.clear(desc)
  await userEvent.type(desc, 'Flip text')
  await userEvent.click(screen.getByRole('button', { name: 'Save tool' }))
  expect(screen.getByText('Flip text')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete reverse_text' }))
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

  expect(await screen.findByText('23 × 19 = 437')).toBeInTheDocument()
  const second = JSON.parse(fetchMock.mock.calls[1][1].body).messages
  expect(second.at(-1).content).toBe('<tool_response>{"name":"calculator","result":437}</tool_response>')
  // the raw tool call is not shown as a chat bubble
  expect(screen.queryByText(/"expression":"23\*19"/)).not.toBeInTheDocument()
})
