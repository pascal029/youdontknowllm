/** What the model needs to know about a tool (no code). */
export type ToolSpec = {
  name: string
  description: string
  /** JSON Schema for the arguments object */
  parameters: object
}

/**
 * System prompt + tool instructions. Small local models have no native function calling,
 * so we teach the format in plain text and parse <tool_call> blocks out of the reply.
 */
export function composeSystemPrompt(system: string, tools: ToolSpec[]): string {
  if (!tools.length) return system
  const list = tools.map((t) => JSON.stringify({ name: t.name, description: t.description, parameters: t.parameters })).join('\n')
  return `${system}

# Tools
You can call tools to help answer. To call a tool, reply with ONLY this, nothing else:
<tool_call>{"name": "<tool name>", "arguments": {<arguments as JSON>}}</tool_call>
You will then get the result inside <tool_response></tool_response>. Use it to answer the user.
Call at most one tool at a time. If no tool is needed, answer normally.

Available tools:
${list}`.trim()
}

/** How a tool result is fed back to the model (as a user turn — works with every chat template). */
export const formatToolResponse = (name: string, result: unknown) =>
  `<tool_response>${JSON.stringify({ name, result })}</tool_response>`
