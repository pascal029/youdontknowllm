import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS, type ProviderSettingsValue } from './ProviderSettings'

function Harness({ onActivate = () => {}, webgpu = true }: { onActivate?: () => void; webgpu?: boolean }) {
  const [v, setV] = useState<ProviderSettingsValue>(DEFAULT_PROVIDER_SETTINGS)
  return <ProviderSettings value={v} onChange={setV} onActivate={onActivate} webgpu={webgpu} />
}

test('local mode lists the 5 models and loads the chosen one', async () => {
  const onActivate = vi.fn()
  render(<Harness onActivate={onActivate} />)
  expect(screen.getAllByRole('option')).toHaveLength(5)
  await userEvent.click(screen.getByRole('button', { name: 'Load model' }))
  expect(onActivate).toHaveBeenCalled()
})

test('disables local loading without WebGPU', () => {
  render(<Harness webgpu={false} />)
  expect(screen.getByRole('button', { name: 'Load model' })).toBeDisabled()
  expect(screen.getByText(/WebGPU not available/)).toBeInTheDocument()
})

test('remote mode shows a masked key field and needs a model name to connect', async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password')
  await userEvent.clear(screen.getByLabelText('Model name'))
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Model name'), 'llama3')
  expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled()
})

describe('downloaded models', () => {
  const first = DEFAULT_PROVIDER_SETTINGS.localModelId

  function Local(props: Partial<Parameters<typeof ProviderSettings>[0]>) {
    const [v, setV] = useState<ProviderSettingsValue>(DEFAULT_PROVIDER_SETTINGS)
    return <ProviderSettings value={v} onChange={setV} onActivate={() => {}} webgpu {...props} />
  }

  test('not downloaded: shows download size, no delete, button says Download & load', () => {
    render(<Local cached={new Set()} onDelete={vi.fn()} />)
    expect(screen.getByText(/Not downloaded · 1\.4 GB download/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download & load (1.4 GB)' })).toBeInTheDocument()
  })

  test('downloaded: marked in the list; delete asks for confirmation, then deletes', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<Local cached={new Set([first])} onDelete={onDelete} />)
    expect(screen.getByRole('option', { name: /Qwen3 0\.6B .* downloaded/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load model' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Qwen3 0.6B from this browser' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Qwen3 0.6B?' })
    expect(dialog).toHaveTextContent('about 1.4 GB')
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete model' }))
    expect(onDelete).toHaveBeenCalledWith(first)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()) // closed <dialog> leaves the a11y tree
  })

  test('cancel keeps the model; the loaded model gets a warning; errors stay in the dialog', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('storage blocked'))
    render(<Local cached={new Set([first])} activeModelId={first} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: /^Delete Qwen3/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^Delete Qwen3/ }))
    expect(screen.getByText(/loaded right now/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete model' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete: storage blocked")
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
  })

  test('status hidden until the cache check finishes', () => {
    render(<Local onDelete={vi.fn()} />)
    expect(screen.queryByText(/downloaded/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load model' })).toBeInTheDocument()
  })
})

test('explains the relay when the base URL is ollama.com', async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole('radio', { name: 'API' }))
  expect(screen.queryByText(/through this site's relay/)).not.toBeInTheDocument()
  const url = screen.getByLabelText('Base URL')
  await userEvent.clear(url)
  await userEvent.type(url, 'https://ollama.com/v1')
  expect(screen.getByText(/through this site's relay/)).toBeInTheDocument()
})
