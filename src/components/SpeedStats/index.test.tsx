import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import SpeedStats from './index'

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

test('live mode shows the live decode rate and tokens so far', () => {
  render(<SpeedStats usage={{ promptTokens: 400, completionTokens: 42, decodeTps: 10 }} ms={2150} live={{ tokens: 17, tps: 31.2 }} />)
  expect(screen.getByText('live')).toBeInTheDocument()
  expect(screen.getByText('31.2')).toBeInTheDocument()
  expect(screen.getByText('17')).toBeInTheDocument()
  expect(screen.getByText('Generating')).toBeInTheDocument()
})

test('liveRate waits for 250ms of data, then tokens/sec', async () => {
  const { liveRate } = await import('./index')
  expect(liveRate(3, 1000, 1100)).toBeUndefined()
  expect(liveRate(10, 1000, 1500)).toBe(20)
})
