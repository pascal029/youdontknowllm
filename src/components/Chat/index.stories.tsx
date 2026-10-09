import type { Meta, StoryObj } from '@storybook/react-vite'
import Chat from './index'

const meta = {
  component: Chat,
  args: { messages: [], busy: false, onSend: () => {}, onStop: () => {} },
  decorators: [(S) => <div style={{ height: 480, display: 'flex' }}><S /></div>],
} satisfies Meta<typeof Chat>
export default meta
type Story = StoryObj<typeof meta>

const convo = [
  { role: 'user' as const, content: 'What is 23 * 19?' },
  { role: 'assistant' as const, content: '23 × 19 = 437.' },
]

export const Empty: Story = {}
export const NoModel: Story = { args: { disabled: true, disabledReason: 'Load a model or connect an API to start.' } }
export const Conversation: Story = { args: { messages: convo } }
export const Streaming: Story = { args: { messages: convo.slice(0, 1), busy: true, streaming: '23 × 19 is' } }
export const WithThinking: Story = {
  args: { messages: [convo[0], { ...convo[1], thinking: '23 * 19 = 23 * 20 - 23 = 460 - 23 = 437.' }] },
}
export const StreamingThinking: Story = {
  args: { messages: convo.slice(0, 1), busy: true, streaming: '<think>23 * 20 is 460, minus 23' },
}
export const AfterCompaction: Story = {
  args: {
    messages: [
      ...convo,
      { role: 'notice', content: 'Context compacted (summary): ≈420 → ≈90 tokens. The model no longer sees the messages above as written.' },
      { role: 'user', content: 'What did I ask first?' },
      { role: 'assistant', content: 'You asked me to multiply 23 by 19.' },
    ],
  },
}
