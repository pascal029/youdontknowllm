import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './index'

function Harness() {
  const [v, setV] = useState(DEFAULT_SYSTEM_PROMPT)
  return <SystemPromptEditor value={v} onChange={setV} />
}

test('edits the prompt and resets to default', async () => {
  render(<Harness />)
  const box = screen.getByRole('textbox', { name: 'System prompt' })
  const reset = screen.getByRole('button', { name: 'Reset' })
  expect(reset).toBeDisabled()

  await userEvent.clear(box)
  await userEvent.type(box, 'You are a pirate.')
  expect(box).toHaveValue('You are a pirate.')
  expect(reset).toBeEnabled()

  await userEvent.click(reset)
  expect(box).toHaveValue(DEFAULT_SYSTEM_PROMPT)
})
