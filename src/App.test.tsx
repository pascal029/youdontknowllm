import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

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
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([{ role: 'user', content: 'hi' }])
})

test('shows API errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
  render(<App />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('API error 500')
})
