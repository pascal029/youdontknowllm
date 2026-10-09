import type { Meta, StoryObj } from '@storybook/react-vite'
import { SUMMARY_ACK, SUMMARY_PREFIX } from '../../agent/compact'
import { formatToolResponse } from '../../agent/prompt'
import type { Message } from '../../llm/types'
import ContextCompactor from './index'

const u = (content: string): Message => ({ role: 'user', content })
const a = (content: string): Message => ({ role: 'assistant', content })
const history: Message[] = [
  u('What is 23 * 19?'),
  a('<tool_call>{"name":"calculator","arguments":{"expression":"23*19"}}</tool_call>'),
  u(formatToolResponse('calculator', 437)),
  a('23 × 19 = 437.'),
  u('Search Wikipedia for WebGPU.'),
  a('<tool_call>{"name":"wikipedia_search","arguments":{"query":"WebGPU"}}</tool_call>'),
  u(formatToolResponse('wikipedia_search', { title: 'WebGPU', extract: 'WebGPU is a JavaScript API provided by web browsers that enables webpage scripts to use the GPU efficiently. '.repeat(6) })),
  a('WebGPU is a browser API that gives web pages efficient access to the GPU.'),
  u('My name is Ana, remember it.'),
  a('Got it, Ana.'),
]

const fakeSummary = async (h: Message[], keepLast: number) => {
  await new Promise((r) => setTimeout(r, 600))
  const tail = keepLast ? h.slice(-keepLast) : []
  return { history: [u(`${SUMMARY_PREFIX}\n- 23 × 19 = 437\n- WebGPU: browser API for the GPU\n- User's name is Ana`), a(SUMMARY_ACK), ...tail], summary: '', usage: { promptTokens: 410, completionTokens: 30 } }
}

const meta = {
  component: ContextCompactor,
  args: { history, systemTokens: 420, contextWindow: 4096, local: false, summarize: fakeSummary, onApply: () => {}, onCancel: () => {} },
  decorators: [(S) => <div style={{ maxWidth: 760 }}><S /></div>],
} satisfies Meta<typeof ContextCompactor>
export default meta
type Story = StoryObj<typeof meta>

export const DropOldest: Story = {}
export const InBrowserModel: Story = { args: { local: true } }
export const Narrow: Story = { decorators: [(S) => <div style={{ maxWidth: 343 }}><S /></div>] }
