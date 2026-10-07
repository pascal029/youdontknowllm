import type { Meta, StoryObj } from '@storybook/react-vite'
import App from './App'

const meta = { component: App, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof App>
export default meta

export const Default: StoryObj<typeof meta> = {}
