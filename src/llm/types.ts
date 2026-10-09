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

/** Optional sampling settings. Unset keys are not sent, so the server/model default applies. */
export type Sampling = {
  temperature?: number
  top_p?: number
  /** not in the OpenAI spec: vLLM/llama.cpp accept it, Groq/OpenAI reject it, WebLLM ignores it */
  top_k?: number
  max_tokens?: number
  seed?: number
}

export interface Provider {
  /** label shown in the UI, e.g. model id */
  name: string
  /** max tokens the model can see at once */
  contextWindow: number
  chat(messages: Message[], signal?: AbortSignal, sampling?: Sampling): AsyncIterable<StreamChunk>
  /** free resources (local models: GPU memory + worker). Remote providers have nothing to free. */
  unload?(): Promise<void>
}
