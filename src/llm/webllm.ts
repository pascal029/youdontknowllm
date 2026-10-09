import { CreateWebWorkerMLCEngine, type InitProgressReport } from '@mlc-ai/web-llm'
import type { LocalModel } from './models'
import { fromOpenAIChunks } from './stream'
import type { Provider, Sampling } from './types'
import { hasWebGPU } from './webgpu'

/** Download (or load from browser cache) a local model and wrap it as a Provider. */
export async function loadWebLLM(model: LocalModel, onProgress: (r: InitProgressReport) => void): Promise<Provider> {
  if (!hasWebGPU()) throw new Error('WebGPU is not available in this browser. Try Chrome or Edge, or use an OpenAI-compatible API.')
  const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' })
  const engine = await CreateWebWorkerMLCEngine(worker, model.id, { initProgressCallback: onProgress })

  return {
    name: model.label,
    contextWindow: model.contextWindow,
    tools: model.tools,
    async *chat(messages, signal, sampling) {
      const onAbort = () => engine.interruptGenerate()
      signal?.addEventListener('abort', onAbort)
      try {
        const stream = await engine.chat.completions.create({
          messages,
          ...withoutTopK(sampling),
          stream: true,
          stream_options: { include_usage: true },
        })
        yield* fromOpenAIChunks(stream)
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    },
    async unload() {
      await engine.unload().catch(() => {}) // a lost GPU device can make unload throw; we're discarding it anyway
      worker.terminate()
    },
  }
}

/** WebLLM's request type has no top_k. */
function withoutTopK(s: Sampling = {}): Omit<Sampling, 'top_k'> {
  const rest = { ...s }
  delete rest.top_k
  return rest
}
