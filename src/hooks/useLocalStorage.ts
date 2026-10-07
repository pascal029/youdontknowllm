import { useEffect, useState } from 'react'

/** useState that survives reloads. Storage can be blocked (private mode), so every access is guarded. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...initial, ...JSON.parse(raw) } : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [key, value])
  return [value, setValue] as const
}
