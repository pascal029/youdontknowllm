import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import ComposedPrompt from './index'

test('collapsed by default, shows token estimate, expands to full text', async () => {
  render(<ComposedPrompt text={'x'.repeat(40)} />)
  expect(screen.getByText('~10 tokens')).toBeInTheDocument()
  const body = screen.getByText('x'.repeat(40))
  expect(body).not.toBeVisible()
  await userEvent.click(screen.getByText(/Full prompt sent/))
  expect(body).toBeVisible()
})
