import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { BUILTIN_TOOLS } from '../../tools/builtin'
import ToolList from './index'

function Stateful(args: Parameters<typeof ToolList>[0]) {
  const [tools, setTools] = useState(args.tools)
  return (
    <div style={{ maxWidth: 280 }}>
      <ToolList {...args} tools={tools} onToggle={(name, enabled) => setTools(tools.map((t) => (t.name === name ? { ...t, enabled } : t)))} />
    </div>
  )
}

const meta = {
  component: ToolList,
  args: { tools: BUILTIN_TOOLS, onToggle: () => {} },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof ToolList>
export default meta
type Story = StoryObj<typeof meta>

export const BuiltIns: Story = {}
export const WithCustomTool: Story = {
  args: {
    tools: [...BUILTIN_TOOLS, { name: 'shout', description: 'Uppercase the given text', parameters: { type: 'object' }, code: 'return args.text.toUpperCase()', enabled: true }],
    onEdit: () => {},
    onDelete: () => {},
  },
}
