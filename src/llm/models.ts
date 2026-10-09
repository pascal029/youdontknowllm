// The 5 local models we ship. All ≤2B params, all in WebLLM's prebuilt catalog.

export type LocalModel = {
  id: string
  label: string
  paramsB: number
  /** approx download / VRAM size in MB */
  sizeMB: number
  contextWindow: number
  /** follows the <tool_call> format reliably enough to be given tools */
  tools: boolean
  note: string
}

export const LOCAL_MODELS: LocalModel[] = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', paramsB: 0.6, sizeMB: 1403, contextWindow: 4096, tools: true, note: 'Smallest. Fast, good for first try.' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', paramsB: 1.0, sizeMB: 879, contextWindow: 4096, tools: false, note: 'Lightest download.' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B', paramsB: 1.5, sizeMB: 1630, contextWindow: 4096, tools: true, note: 'Solid at following tool formats.' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 1.7B', paramsB: 1.7, sizeMB: 1774, contextWindow: 4096, tools: false, note: 'Compact English chat model.' },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B', paramsB: 1.7, sizeMB: 2037, contextWindow: 4096, tools: true, note: 'Best quality here, slowest.' },
]
