import type { Meta, StoryObj } from '@storybook/react-vite'
import SpeedStats from './SpeedStats'

const meta = {
  component: SpeedStats,
  args: { usage: { promptTokens: 471, completionTokens: 93, prefillTps: 640, decodeTps: 38.2 }, ms: 1215 },
  decorators: [(S) => <div style={{ maxWidth: 320 }}><S /></div>],
} satisfies Meta<typeof SpeedStats>
export default meta
type Story = StoryObj<typeof meta>

export const Remote: Story = {}
export const SlowLocal: Story = { args: { usage: { promptTokens: 380, completionTokens: 60, prefillTps: 95, decodeTps: 8.4 }, ms: 9100 } }
export const Unknown: Story = { args: { usage: { promptTokens: 0, completionTokens: 0 }, ms: 0 } }
