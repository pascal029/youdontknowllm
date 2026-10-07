import type { Meta, StoryObj } from '@storybook/react-vite'
import ContextMeter from './ContextMeter'

const meta = { component: ContextMeter, args: { used: 600, total: 4096 }, decorators: [(S) => <div style={{ maxWidth: 320 }}><S /></div>] } satisfies Meta<typeof ContextMeter>
export default meta
type Story = StoryObj<typeof meta>

export const Fresh: Story = { args: { used: 0 } }
export const Low: Story = {}
export const Warning: Story = { args: { used: 2900 } }
export const AlmostFull: Story = { args: { used: 3900 } }
