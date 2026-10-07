import type { Meta, StoryObj } from '@storybook/react-vite'
import LoadProgress from './LoadProgress'

const meta = { component: LoadProgress, args: { progress: 0.42, text: 'Fetching param cache[8/20]: 600MB fetched. 42% completed, 12 secs elapsed.' } } satisfies Meta<typeof LoadProgress>
export default meta
type Story = StoryObj<typeof meta>

export const Downloading: Story = {}
export const Starting: Story = { args: { progress: 0, text: 'Start to fetch params' } }
export const Done: Story = { args: { progress: 1, text: 'Finish loading on WebGPU' } }
