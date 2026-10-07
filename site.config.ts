// Single source of truth for the public URL (canonical links, sitemap, OG tags).
export const SITE_URL = 'https://youdontknowllm.netlify.app'
export const SITE_NAME = 'youdontknowllm'

export type Lesson = { slug: string; title: string; blurb: string }

/** The learning path, in order. Drives /learn/, the landing page list, ItemList JSON-LD and prev/next links. */
export const LESSONS: Lesson[] = [
  { slug: 'what-is-a-token', title: 'What is a token?', blurb: 'Models read pieces of words mapped to numbers, not words.' },
  { slug: 'context-window', title: 'The context window', blurb: "The model's working memory, and what happens when it fills up." },
  { slug: 'system-prompt', title: 'The system prompt', blurb: 'The hidden instructions sent before every conversation.' },
  { slug: 'function-calling', title: 'How function calling works', blurb: 'A model can only write text. Here is how that text becomes a tool call.' },
  { slug: 'prefill-vs-decode', title: 'Prefill vs decode', blurb: 'The two speeds of every LLM: reading your prompt and writing the answer.' },
  { slug: 'run-llm-in-browser', title: 'Run an LLM in your browser', blurb: 'WebGPU, small models, and what to expect from a 1B model on your laptop.' },
]
