import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import Modal from './Modal'

function Demo({ size, withFooter }: { size?: 'sm' | 'md' | 'lg'; withFooter?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Open modal</button>
      <Modal
        open={open}
        size={size}
        title="Delete Qwen3 0.6B?"
        onClose={() => setOpen(false)}
        footer={withFooter && (
          <>
            <button className="btn btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn--danger-solid" onClick={() => setOpen(false)}>Delete</button>
          </>
        )}
      >
        <p style={{ margin: 0 }}>This frees about 1.4 GB. You can download it again any time.</p>
      </Modal>
    </>
  )
}

const meta = { component: Demo, args: { size: 'sm', withFooter: true } } satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const Confirm: Story = {}
export const Large: Story = { args: { size: 'lg', withFooter: false } }
