import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import Modal from './index'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} title="Delete model?" onClose={() => { onClose(); setOpen(false) }} footer={<button>Confirm</button>}>
        <p>Body text</p>
      </Modal>
    </>
  )
}

test('opens as a labelled dialog with body and footer; content only rendered while open', async () => {
  render(<Harness />)
  expect(screen.queryByText('Body text')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete model?' })
  expect(dialog).toHaveAttribute('open')
  expect(screen.getByText('Body text')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
})

test('closes via the close button, Esc (cancel) and backdrop click', async () => {
  const onClose = vi.fn()
  render(<Harness onClose={onClose} />)
  const open = () => userEvent.click(screen.getByRole('button', { name: 'Open' }))

  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('Body text')).not.toBeInTheDocument()

  await open()
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByText('Body text')).not.toBeInTheDocument()

  await open()
  fireEvent.mouseDown(screen.getByRole('dialog')) // target is the dialog itself = backdrop
  fireEvent.click(screen.getByRole('dialog'))
  expect(onClose).toHaveBeenCalledTimes(3)
})

test('clicks inside the panel do not close it', async () => {
  const onClose = vi.fn()
  render(<Harness onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  await userEvent.click(screen.getByText('Body text'))
  expect(onClose).not.toHaveBeenCalled()
})

test('a text selection dragged from inside out to the backdrop does not close it', async () => {
  const onClose = vi.fn()
  render(<Harness onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  fireEvent.mouseDown(screen.getByText('Body text'))
  fireEvent.click(screen.getByRole('dialog')) // browsers fire click on the common ancestor
  expect(onClose).not.toHaveBeenCalled()
})
