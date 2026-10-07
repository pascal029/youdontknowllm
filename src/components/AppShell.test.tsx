import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import AppShell from './AppShell'

test('renders the three regions with their content', () => {
  render(<AppShell sidebar={<p>settings</p>} main={<p>chat</p>} inspector={<p>steps</p>} />)
  expect(screen.getByRole('complementary', { name: 'Settings' })).toHaveTextContent('settings')
  expect(screen.getByRole('main')).toHaveTextContent('chat')
  expect(screen.getByRole('complementary', { name: 'Steps and stats' })).toHaveTextContent('steps')
})

test('header links home and to the guides', () => {
  render(<AppShell sidebar={null} main={null} inspector={null} />)
  expect(screen.getByRole('link', { name: 'youdontknowllm' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/learn/')
})
