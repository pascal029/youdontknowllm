import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
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
  await userEvent.click(screen.getByRole('radio', { name: 'OpenAI-compatible' }))
  expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password')
  await userEvent.clear(screen.getByLabelText('Model name'))
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Model name'), 'llama3')
  expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled()
})
