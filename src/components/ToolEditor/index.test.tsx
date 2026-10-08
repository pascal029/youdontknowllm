import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BUILTIN_TOOLS } from '../../tools/builtin'
import ToolEditor, { NEW_TOOL_TEMPLATE } from './index'

const setup = (over: Partial<Parameters<typeof ToolEditor>[0]> = {}) => {
  const props = { initial: NEW_TOOL_TEMPLATE, takenNames: [], onSave: vi.fn(), onCancel: vi.fn(), run: vi.fn(), ...over }
  render(<ToolEditor {...props} />)
  return props
}

test('saves a valid tool with parsed parameters', async () => {
  const { onSave } = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Save tool' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'reverse_text', parameters: NEW_TOOL_TEMPLATE.parameters }))
})

test('shows JSON errors near the form and does not save', async () => {
  const { onSave } = setup()
  const params = screen.getByLabelText('Parameters (JSON Schema)')
  await userEvent.clear(params)
  await userEvent.type(params, '{{oops')
  await userEvent.click(screen.getByRole('button', { name: 'Save tool' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Parameters: invalid JSON')
  expect(onSave).not.toHaveBeenCalled()
})

test('shows validation errors (bad name, duplicate)', async () => {
  const { onSave } = setup({ takenNames: ['reverse_text'] })
  await userEvent.click(screen.getByRole('button', { name: 'Save tool' }))
  expect(screen.getByRole('alert')).toHaveTextContent('already exists')
  await userEvent.clear(screen.getByLabelText('Name'))
  await userEvent.type(screen.getByLabelText('Name'), 'Bad Name')
  await userEvent.click(screen.getByRole('button', { name: 'Save tool' }))
  expect(screen.getByRole('alert')).toHaveTextContent('snake_case')
  expect(onSave).not.toHaveBeenCalled()
})

test('test run executes code with test args and shows result + logs', async () => {
  const run = vi.fn().mockResolvedValue({ ok: true, result: 'olleh', logs: ['reversing'], ms: 3 })
  setup({ run })
  await userEvent.click(screen.getByRole('button', { name: 'Test run' }))
  expect(run).toHaveBeenCalledWith(NEW_TOOL_TEMPLATE.code, { text: 'hello' })
  expect(screen.getByRole('status')).toHaveTextContent('→ "olleh"')
  expect(screen.getByRole('status')).toHaveTextContent('reversing')
})

test('test run shows errors', async () => {
  setup({ run: vi.fn().mockResolvedValue({ ok: false, error: 'Timed out after 3000ms (worker killed).', logs: [], ms: 3000 }) })
  await userEvent.click(screen.getByRole('button', { name: 'Test run' }))
  expect(screen.getByRole('status')).toHaveTextContent('✕ Timed out')
})

test('cancel', async () => {
  const { onCancel } = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalled()
})

test('read-only (built-in): fields locked, no Save, Test run uses the example, Duplicate offered', async () => {
  const run = vi.fn().mockResolvedValue({ ok: true, result: 437, logs: [], ms: 2 })
  const onDuplicate = vi.fn()
  const calc = BUILTIN_TOOLS[0]
  setup({ initial: calc, readOnly: true, onDuplicate, run })

  expect(screen.getByText(/Built-in tool: read-only/)).toBeInTheDocument()
  expect(screen.getByLabelText('Code')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Name')).toHaveAttribute('readonly')
  expect(screen.queryByRole('button', { name: 'Save tool' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Test arguments')).toHaveValue(JSON.stringify(calc.example))

  await userEvent.click(screen.getByRole('button', { name: 'Test run' }))
  expect(run).toHaveBeenCalledWith(calc.code, calc.example)
  expect(screen.getByRole('status')).toHaveTextContent('→ 437')

  await userEvent.click(screen.getByRole('button', { name: 'Duplicate & edit' }))
  expect(onDuplicate).toHaveBeenCalled()
})

test('new tools pre-fill test arguments from their schema', () => {
  setup()
  expect(screen.getByLabelText('Test arguments')).toHaveValue('{"text":"hello"}')
})
