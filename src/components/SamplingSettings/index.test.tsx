import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import type { Sampling } from '../../llm/types'
import SamplingSettings from './index'

function Harness({ initial = {}, spy }: { initial?: Sampling; spy?: (v: Sampling) => void }) {
  const [v, setV] = useState<Sampling>(initial)
  return <SamplingSettings value={v} onChange={(n) => { setV(n); spy?.(n) }} />
}

test('everything starts unset (model defaults)', () => {
  render(<Harness />)
  expect(screen.getByText('model defaults')).toBeInTheDocument()
  expect(screen.getByRole('spinbutton', { name: 'Temperature' })).toHaveValue(null)
  expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled()
})

test('typing or sliding sets a value; clearing the field unsets it', async () => {
  const spy = vi.fn()
  render(<Harness spy={spy} />)
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Seed' }), '42')
  expect(spy).toHaveBeenLastCalledWith({ seed: 42 })

  fireEvent.change(screen.getByRole('slider', { name: 'Temperature slider' }), { target: { value: '0.5' } })
  expect(spy).toHaveBeenLastCalledWith({ seed: 42, temperature: 0.5 })
  expect(screen.getByText('2 set')).toBeInTheDocument()

  await userEvent.clear(screen.getByRole('spinbutton', { name: 'Seed' }))
  expect(spy).toHaveBeenLastCalledWith({ temperature: 0.5 })
})

test('warns about top_k only once it is set', () => {
  render(<Harness initial={{ top_k: 5 }} />)
  expect(screen.getByText(/Groq and OpenAI reject it/)).toBeInTheDocument()
})

test('reset clears every setting', async () => {
  const spy = vi.fn()
  render(<Harness initial={{ temperature: 0, top_p: 0.9 }} spy={spy} />)
  await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
  expect(spy).toHaveBeenLastCalledWith({})
  expect(screen.getByText('model defaults')).toBeInTheDocument()
})

test('links to the sampling lesson', () => {
  render(<Harness />)
  expect(screen.getByRole('link', { name: 'How sampling works' })).toHaveAttribute('href', '/learn/sampling/')
})
