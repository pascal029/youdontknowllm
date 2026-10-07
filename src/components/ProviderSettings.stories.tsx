import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './ProviderSettings'

const meta = {
  component: ProviderSettings,
  args: { value: DEFAULT_PROVIDER_SETTINGS, onChange: () => {}, onActivate: () => {}, webgpu: true },
  render: (args) => {
    const [v, setV] = useState(args.value)
    return <div style={{ maxWidth: 280 }}><ProviderSettings {...args} value={v} onChange={setV} /></div>
  },
} satisfies Meta<typeof ProviderSettings>
export default meta
type Story = StoryObj<typeof meta>

export const Local: Story = {}
export const Loading: Story = { args: { busy: true } }
export const NoWebGPU: Story = { args: { webgpu: false } }
export const Remote: Story = { args: { value: { ...DEFAULT_PROVIDER_SETTINGS, mode: 'remote' } } }
