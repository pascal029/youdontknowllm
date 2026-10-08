import type { Meta, StoryObj } from '@storybook/react-vite'
import { composeSystemPrompt } from '../../agent/prompt'
import ComposedPrompt from './index'
import { DEFAULT_SYSTEM_PROMPT } from '../SystemPromptEditor'

const meta = { component: ComposedPrompt, args: { text: DEFAULT_SYSTEM_PROMPT }, decorators: [(S) => <div style={{ maxWidth: 320 }}><S /></div>] } satisfies Meta<typeof ComposedPrompt>
export default meta
type Story = StoryObj<typeof meta>

export const NoTools: Story = {}
export const WithTools: Story = {
  args: {
    text: composeSystemPrompt(DEFAULT_SYSTEM_PROMPT, [
      { name: 'calculator', description: 'Evaluate a math expression', parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } },
      { name: 'get_current_time', description: 'Current date and time', parameters: { type: 'object', properties: {} } },
    ]),
  },
}
