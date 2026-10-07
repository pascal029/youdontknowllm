import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import SpeedStats from './SpeedStats'

test('shows prefill, decode and call time', () => {
  render(<SpeedStats usage={{ promptTokens: 400, completionTokens: 42, prefillTps: 812.4, decodeTps: 23.456 }} ms={2150} />)
  const stats = screen.getByLabelText('Inference speed')
  expect(within(stats).getByText('812')).toBeInTheDocument()
  expect(within(stats).getByText('23.5')).toBeInTheDocument()
  expect(within(stats).getByText('2.15')).toBeInTheDocument()
  expect(within(stats).getByText('42 tokens out')).toBeInTheDocument()
})

test('unknown speeds show a dash', () => {
  render(<SpeedStats usage={{ promptTokens: 0, completionTokens: 0 }} ms={0} />)
  expect(screen.getAllByText('—')).toHaveLength(2)
})
