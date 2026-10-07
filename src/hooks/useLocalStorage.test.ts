import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

beforeEach(() => localStorage.clear())

test('persists and restores, merging new default fields', () => {
  const { result } = renderHook(() => useLocalStorage('k', { a: 1 }))
  act(() => result.current[1]({ a: 2 }))
  expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ a: 2 })

  const again = renderHook(() => useLocalStorage('k', { a: 1, b: 'new' }))
  expect(again.result.current[0]).toEqual({ a: 2, b: 'new' })
})

test('falls back to default on corrupt storage', () => {
  localStorage.setItem('k', '{not json')
  const { result } = renderHook(() => useLocalStorage('k', { a: 1 }))
  expect(result.current[0]).toEqual({ a: 1 })
})
