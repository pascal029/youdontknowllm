// One interface for every backend (local WebLLM or remote OpenAI-compatible).

export type Role = 'system' | 'user' | 'assistant'

export type Message = { role: Role; content: string }

export type Usage = {
  promptTokens: number
  completionTokens: number
  /** tokens/sec while reading the prompt (prefill) */
  prefillTps?: number
  /** tokens/sec while generating (decode) */
  decodeTps?: number
}

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage: Usage }

export interface Provider {
  /** label shown in the UI, e.g. model id */
  name: string
  /** max tokens the model can see at once */
  contextWindow: number
  chat(messages: Message[], signal?: AbortSignal): AsyncIterable<StreamChunk>
}
