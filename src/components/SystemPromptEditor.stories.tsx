import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './SystemPromptEditor'

function Stateful({ value }: { value: string }) {
  const [v, setV] = useState(value)
  return <div style={{ maxWidth: 280 }}><SystemPromptEditor value={v} onChange={setV} /></div>
}

const meta = {
  component: SystemPromptEditor,
  args: { value: DEFAULT_SYSTEM_PROMPT, onChange: () => {} },
  render: (args) => <Stateful value={args.value} />,
} satisfies Meta<typeof SystemPromptEditor>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Custom: Story = { args: { value: 'You are a pirate. Answer every question like a pirate would.' } }
