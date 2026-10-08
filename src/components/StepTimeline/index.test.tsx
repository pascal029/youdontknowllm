import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import type { Step } from '../../agent/loop'
import StepTimeline from './index'

const TOOL_ROUND_TRIP: Step[] = [
  { type: 'user', text: 'What is 23*19?' },
  { type: 'model', iteration: 1, text: '<tool_call>{"name":"calculator","arguments":{"expression":"23*19"}}</tool_call>', usage: { promptTokens: 412, completionTokens: 24 }, ms: 830 },
  { type: 'tool-call', name: 'calculator', arguments: { expression: '23*19' } },
  { type: 'tool-result', name: 'calculator', result: { ok: true, result: 437, logs: [], ms: 4 } },
  { type: 'model', iteration: 2, text: '23 × 19 = 437', usage: { promptTokens: 460, completionTokens: 9 }, ms: 310 },
  { type: 'answer', text: '23 × 19 = 437' },
]

test('empty state explains what will appear', () => {
  render(<StepTimeline steps={[]} />)
  expect(screen.getByText(/Send a message to see each step/)).toBeInTheDocument()
})

test('renders every step of a tool round-trip in order', () => {
  render(<StepTimeline steps={TOOL_ROUND_TRIP} />)
  const items = within(screen.getByRole('list', { name: 'Agent steps' })).getAllByRole('listitem')
  expect(items.map((li) => li.querySelector('.step__title')?.textContent)).toEqual([
    'You asked',
    'Model call #1',
    'Model chose tool: calculator',
    'calculator returned',
    'Model call #2',
    'Final answer',
  ])
  expect(screen.getByText('830 ms · 412 in / 24 out')).toBeInTheDocument()
  expect(screen.getByText('4 ms in sandbox')).toBeInTheDocument()
})

test('raw event JSON is collapsed until expanded', async () => {
  render(<StepTimeline steps={TOOL_ROUND_TRIP.slice(2, 3)} />)
  const raw = screen.getByText(/"type": "tool-call"/)
  expect(raw).not.toBeVisible()
  await userEvent.click(screen.getByText('raw event'))
  expect(raw).toBeVisible()
})

test('shows live generation', () => {
  render(<StepTimeline steps={TOOL_ROUND_TRIP.slice(0, 1)} streaming="<tool_call>{" />)
  expect(screen.getByText('Model is generating…')).toBeInTheDocument()
  expect(screen.getByText('<tool_call>{')).toBeInTheDocument()
})

test('errors are highlighted with an explanation', () => {
  render(
    <StepTimeline
      steps={[
        { type: 'parse-error', error: 'Tool call is not valid JSON.', raw: '<tool_call>{bad}</tool_call>' },
        { type: 'tool-result', name: 'run_javascript', result: { ok: false, error: 'Timed out after 3000ms (worker killed).', logs: [], ms: 3001 } },
        { type: 'error', error: 'Stopped after 5 model calls without a final answer.' },
      ]}
    />,
  )
  const items = screen.getAllByRole('listitem')
  expect(items.every((li) => li.classList.contains('is-error'))).toBe(true)
  expect(screen.getByText('Could not read tool call')).toBeInTheDocument()
  expect(screen.getByText('run_javascript failed')).toBeInTheDocument()
  expect(screen.getByText(/Small models often break the format/)).toBeInTheDocument()
  expect(screen.getByText(/sent back to the model/)).toBeInTheDocument()
})

test('successful steps are not marked as errors', () => {
  render(<StepTimeline steps={TOOL_ROUND_TRIP} />)
  expect(document.querySelectorAll('.is-error')).toHaveLength(0)
})
