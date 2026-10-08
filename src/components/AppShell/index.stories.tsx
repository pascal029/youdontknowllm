import type { Meta, StoryObj } from '@storybook/react-vite'
import AppShell from './index'

const meta = {
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    sidebar: <p>Model, provider, system prompt, tools</p>,
    main: <p>Chat</p>,
    inspector: <p>Step timeline + stats</p>,
  },
} satisfies Meta<typeof AppShell>
export default meta

export const Default: StoryObj<typeof meta> = {}
