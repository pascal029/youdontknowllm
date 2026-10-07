import type { Step } from './loop'

/** Tokens the conversation currently occupies = last model call's prompt + its reply. */
export function contextUsed(steps: Step[]): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]
    if (s.type === 'model') return s.usage.promptTokens + s.usage.completionTokens
  }
  return 0
}
