// Kept separate from webllm.ts so checking support doesn't pull in the WebLLM bundle.
export const hasWebGPU = () => typeof navigator !== 'undefined' && 'gpu' in navigator
