import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BUILTIN_TOOLS } from '../tools/builtin'
import type { Tool } from '../tools/types'
import ToolList from './ToolList'

const custom: Tool = { name: 'shout', description: 'Uppercase text', parameters: { type: 'object' }, code: 'return 1', enabled: false }

test('lists tools with enabled state and toggles them', async () => {
  const onToggle = vi.fn()
  render(<ToolList tools={[...BUILTIN_TOOLS, custom]} onToggle={onToggle} />)
  expect(screen.getByRole('list', { name: 'Tools, 5 of 6 enabled' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /shout/ })).not.toBeChecked()
  await userEvent.click(screen.getByRole('checkbox', { name: /calculator/ }))
  expect(onToggle).toHaveBeenCalledWith('calculator', false)
})

test('built-ins get "View code"; only custom tools get Edit/Delete', async () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(<ToolList tools={[...BUILTIN_TOOLS, custom]} onToggle={() => {}} onEdit={onEdit} onDelete={onDelete} />)
  expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: /^Delete/ })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: /^View .* code$/ })).toHaveLength(BUILTIN_TOOLS.length)
  await userEvent.click(screen.getByRole('button', { name: 'View calculator code' }))
  expect(onEdit).toHaveBeenCalledWith(BUILTIN_TOOLS[0])
  await userEvent.click(screen.getByRole('button', { name: 'Edit shout' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete shout' }))
  expect(onEdit).toHaveBeenCalledWith(custom)
  expect(onDelete).toHaveBeenCalledWith(custom)
})
