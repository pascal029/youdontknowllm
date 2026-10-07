import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Step } from '../agent/loop'
import StepTimeline from './StepTimeline'

const roundTrip: Step[] = [
  { type: 'user', text: 'What is 23*19?' },
  { type: 'model', iteration: 1, text: '<tool_call>{"name":"calculator","arguments":{"expression":"23*19"}}</tool_call>', usage: { promptTokens: 412, completionTokens: 24 }, ms: 830 },
  { type: 'tool-call', name: 'calculator', arguments: { expression: '23*19' } },
  { type: 'tool-result', name: 'calculator', result: { ok: true, result: 437, logs: [], ms: 4 } },
  { type: 'model', iteration: 2, text: '23 × 19 = 437', usage: { promptTokens: 460, completionTokens: 9 }, ms: 310 },
  { type: 'answer', text: '23 × 19 = 437' },
]

const meta = { component: StepTimeline, args: { steps: roundTrip }, decorators: [(S) => <div style={{ maxWidth: 360 }}><S /></div>] } satisfies Meta<typeof StepTimeline>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { steps: [] } }
export const ToolRoundTrip: Story = {}
export const Generating: Story = { args: { steps: roundTrip.slice(0, 1), streaming: '<tool_call>{"name": "calcu' } }
export const DirectAnswer: Story = {
  args: {
    steps: [
      { type: 'user', text: 'Hi!' },
      { type: 'model', iteration: 1, text: 'Hello! How can I help?', usage: { promptTokens: 380, completionTokens: 7 }, ms: 240 },
      { type: 'answer', text: 'Hello! How can I help?' },
    ],
  },
}
