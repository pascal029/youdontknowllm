import type { ToolSpec } from '../agent/prompt'

/**
 * A tool = what the model sees (ToolSpec) + the JS that runs it.
 * `code` is an async function body. It gets `args` (the parsed arguments object)
 * and returns any JSON-serialisable value. It always runs inside the sandbox worker.
 */
export type Tool = ToolSpec & {
  code: string
  enabled: boolean
  builtin?: boolean
}

const NAME = /^[a-z_][a-z0-9_]{0,63}$/

/** Returns human-readable problems; empty array = valid. */
export function validateTool(t: Pick<Tool, 'name' | 'description' | 'parameters' | 'code'>, existingNames: string[] = []): string[] {
  const errors: string[] = []
  if (!NAME.test(t.name)) errors.push('Name must be snake_case: lowercase letters, digits, underscores (max 64).')
  else if (existingNames.includes(t.name)) errors.push(`A tool named "${t.name}" already exists.`)
  if (!t.description.trim()) errors.push('Description is required — the model uses it to decide when to call the tool.')
  const p = t.parameters as { type?: unknown; properties?: unknown }
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.type !== 'object') errors.push('Parameters must be a JSON Schema object with "type": "object".')
  else if (p.properties !== undefined && (typeof p.properties !== 'object' || Array.isArray(p.properties))) errors.push('"properties" must be an object.')
  if (!t.code.trim()) errors.push('Code is required.')
  return errors
}
