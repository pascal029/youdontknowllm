import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import LoadProgress from './index'

test('shows rounded percent and status text', () => {
  render(<LoadProgress progress={0.426} text="Fetching param cache[3/20]" />)
  expect(screen.getByText('43%')).toBeInTheDocument()
  expect(screen.getByLabelText('Model load progress')).toHaveAttribute('value', '43')
  expect(screen.getByText('Fetching param cache[3/20]')).toBeInTheDocument()
})
