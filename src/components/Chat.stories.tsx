import type { Meta, StoryObj } from '@storybook/react-vite'
import Chat from './Chat'

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
