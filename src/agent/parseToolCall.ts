export type ParsedReply =
  | { kind: 'answer'; text: string }
  | { kind: 'call'; name: string; arguments: Record<string, unknown>; raw: string }
  | { kind: 'error'; error: string; raw: string }

const stripThink = (s: string) => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim()
const stripFence = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

function toCall(json: string, raw: string): ParsedReply {
  let obj: unknown
  try {
    obj = JSON.parse(stripFence(json))
  } catch {
    return { kind: 'error', error: 'Tool call is not valid JSON.', raw }
  }
  const o = obj as { name?: unknown; arguments?: unknown }
  if (!o || typeof o.name !== 'string' || !o.name) return { kind: 'error', error: 'Tool call is missing "name".', raw }
  let args = o.arguments ?? {}
  if (typeof args === 'string') {
    // some models double-encode the arguments
    try {
      args = JSON.parse(args)
    } catch {
      return { kind: 'error', error: '"arguments" is a string that is not valid JSON.', raw }
    }
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return { kind: 'error', error: '"arguments" must be an object.', raw }
  const inner = args as { name?: unknown; arguments?: unknown }
  if (o.name === 'tool_call' && typeof inner.name === 'string') {
    // gpt-oss sometimes treats our <tool_call> wrapper as a function: {"name":"tool_call","arguments":{"name":"calculator",...}}
    return toCall(JSON.stringify({ name: inner.name, arguments: inner.arguments ?? {} }), raw)
  }
  return { kind: 'call', name: o.name, arguments: args as Record<string, unknown>, raw }
}

/** Decide whether a model reply is a final answer or a tool call. */
export function parseToolCall(reply: string): ParsedReply {
  const text = stripThink(reply)
  const tagged = text.match(/<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/)
  if (tagged) return toCall(tagged[1], tagged[0])

  // Small models often drop the tags and emit bare JSON — accept it only when that's the whole reply.
  const bare = stripFence(text)
  if (bare.startsWith('{') && bare.endsWith('}') && /"name"\s*:/.test(bare)) return toCall(bare, text)

  // Nothing visible at all: some hosts (Groq + gpt-oss) stream the call inside the thinking channel.
  if (!text) {
    const hidden = reply.match(/<tool_call>([\s\S]*?)(?:<\/tool_call>|<\/think>|$)/)
    if (hidden) return toCall(hidden[1], hidden[0])
  }

  return { kind: 'answer', text }
}
