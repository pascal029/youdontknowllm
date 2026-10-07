// Local-model lifecycle in the App: cache status, load, delete (with unload). WebGPU/WebLLM are mocked.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { LOCAL_MODELS } from './llm/models'

const cache = new Set<string>()
const unload = vi.fn(async () => {})

vi.mock('./llm/webgpu', () => ({ hasWebGPU: () => true }))
vi.mock('./llm/cache', () => ({
  cachedModelIds: vi.fn(async (ids: string[]) => new Set(ids.filter((id) => cache.has(id)))),
  deleteCachedModel: vi.fn(async (id: string) => {
    cache.delete(id)
  }),
}))
vi.mock('./llm/webllm', () => ({
  loadWebLLM: vi.fn(async (model: { id: string; label: string; contextWindow: number }) => {
    cache.add(model.id) // loading downloads it
    return { name: model.label, contextWindow: model.contextWindow, chat: async function* () {}, unload }
  }),
}))

const { default: App } = await import('./App')
const first = LOCAL_MODELS[0]

beforeEach(() => {
  localStorage.clear()
  cache.clear()
  unload.mockClear()
})

test('load marks the model downloaded; deleting the loaded model unloads it first', async () => {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Download & load/ }))
  expect(await screen.findByText(`Ready: ${first.label}`)).toBeInTheDocument()
  expect(await screen.findByText(/^Downloaded ·/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: `Delete ${first.label} from this browser` }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete model' }))

  await waitFor(() => expect(cache.has(first.id)).toBe(false))
  expect(unload).toHaveBeenCalledTimes(1)
  expect(screen.queryByText(`Ready: ${first.label}`)).not.toBeInTheDocument()
  expect(await screen.findByText(/^Not downloaded ·/)).toBeInTheDocument()
  expect(screen.getByLabelText('Message')).toBeDisabled()
})

test('deleting a different (not loaded) model keeps the current one loaded', async () => {
  cache.add(LOCAL_MODELS[1].id)
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Download & load/ }))
  await screen.findByText(`Ready: ${first.label}`)

  await userEvent.selectOptions(screen.getByLabelText('Local model'), LOCAL_MODELS[1].id)
  await userEvent.click(await screen.findByRole('button', { name: `Delete ${LOCAL_MODELS[1].label} from this browser` }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete model' }))

  await waitFor(() => expect(cache.has(LOCAL_MODELS[1].id)).toBe(false))
  expect(unload).not.toHaveBeenCalled()
  expect(screen.getByText(`Ready: ${first.label}`)).toBeInTheDocument()
})

test('switching to another model unloads the previous one (frees GPU memory)', async () => {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Download & load/ }))
  await screen.findByText(`Ready: ${first.label}`)
  await userEvent.selectOptions(screen.getByLabelText('Local model'), LOCAL_MODELS[1].id)
  await userEvent.click(screen.getByRole('button', { name: /Download & load/ }))
  await screen.findByText(`Ready: ${LOCAL_MODELS[1].label}`)
  expect(unload).toHaveBeenCalledTimes(1)
})
