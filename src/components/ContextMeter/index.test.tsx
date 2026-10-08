import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ContextMeter, { contextLevel } from './index'

test('shows tokens left, used/total and percent', () => {
  render(<ContextMeter used={1024} total={4096} />)
  expect(screen.getByText('3,072 left')).toBeInTheDocument()
  expect(screen.getByText(/1,024 \/ 4,096 tokens \(25%\)/)).toBeInTheDocument()
  expect(screen.getByLabelText('Context window used')).toHaveAttribute('value', '1024')
})

test('levels: ok < 60% ≤ warn < 85% ≤ danger', () => {
  expect(contextLevel(59)).toBe('ok')
  expect(contextLevel(60)).toBe('warn')
  expect(contextLevel(85)).toBe('danger')
})

test('near-full warns the learner; overflow clamps to 0 left', () => {
  render(<ContextMeter used={5000} total={4096} />)
  expect(screen.getByText('0 left')).toBeInTheDocument()
  expect(screen.getByText(/almost full/)).toBeInTheDocument()
})
