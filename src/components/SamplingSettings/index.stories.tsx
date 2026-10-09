import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Sampling } from '../../llm/types'
import SamplingSettings from './index'

function Stateful({ value }: { value: Sampling }) {
  const [v, setV] = useState(value)
  return <div style={{ maxWidth: 280 }}><SamplingSettings value={v} onChange={setV} /></div>
}

const meta = {
  component: SamplingSettings,
  args: { value: {}, onChange: () => {} },
  render: (args) => <Stateful value={args.value} />,
  play: async ({ canvasElement }) => canvasElement.querySelector('details')?.setAttribute('open', ''),
} satisfies Meta<typeof SamplingSettings>
export default meta
type Story = StoryObj<typeof meta>

export const Defaults: Story = {}
export const Deterministic: Story = { args: { value: { temperature: 0, seed: 42 } } }
export const AllSet: Story = { args: { value: { temperature: 0.7, top_p: 0.9, top_k: 40, max_tokens: 512, seed: 1 } } }
