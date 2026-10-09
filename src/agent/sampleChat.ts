// A canned conversation for filling the context window quickly, so compaction can be tried without chatting for an hour.
import type { Message } from '../llm/types'
import { historyTokens } from './compact'
import { formatToolResponse } from './prompt'

type Turn = { q: string; tool?: { name: string; arguments: Record<string, unknown>; result: unknown }; a: string }

const WIKI = [
  {
    title: 'WebGPU',
    snippet:
      'WebGPU is a JavaScript API provided by web browsers that lets web pages use the graphics processing unit of the device for rendering and for general purpose computation. ' +
      'It was designed as the successor to WebGL, with a lower overhead model that maps more closely to modern native graphics interfaces such as Vulkan, Metal and Direct3D 12. ' +
      'Work on the standard started in a community group and moved to a working group, and the first browsers shipped it after several years of development. ' +
      'Besides drawing, it exposes compute shaders, which is what makes it useful for running machine learning models directly in a web page without any server.',
    url: 'https://en.wikipedia.org/wiki/WebGPU',
  },
  {
    title: 'WebGL',
    snippet:
      'WebGL is a JavaScript API for rendering interactive two and three dimensional graphics in a web browser without plug-ins. ' +
      'It is based on an older native graphics standard and runs in the HTML canvas element. ' +
      'It is widely supported, but its design makes general purpose computation awkward, which is one of the reasons a newer interface was created.',
    url: 'https://en.wikipedia.org/wiki/WebGL',
  },
  {
    title: 'Shader',
    snippet:
      'In computer graphics, a shader is a small program that runs on the graphics processor. Vertex shaders place shapes on the screen, fragment shaders decide the colour of each pixel, ' +
      'and compute shaders run arbitrary parallel work, such as the large matrix multiplications at the heart of a neural network.',
    url: 'https://en.wikipedia.org/wiki/Shader',
  },
]

/** Facts in the first turn, so "what's my name?" after compacting shows what was forgotten. */
const FIRST: Turn = { q: 'Hi! My name is Ana, I live in Bandung and my cat is called Miso.', a: 'Nice to meet you, Ana! Say hi to Miso for me.' }

/** Repeated after the first turn until the window is full: tool calls, one big tool result, long and short answers. */
const FILLER: Turn[] = [
  { q: 'What is 23 * 19?', tool: { name: 'calculator', arguments: { expression: '23*19' }, result: 437 }, a: '23 × 19 = 437.' },
  {
    // ponytail: prose on purpose, chars/4 is close for English; digit-heavy results (tables, JSON numbers) cost ~2x more real tokens
    q: 'Search Wikipedia for WebGPU and tell me what it is.',
    tool: { name: 'wikipedia_search', arguments: { query: 'WebGPU' }, result: WIKI },
    a: 'WebGPU is a browser API that lets web pages use the GPU for fast graphics and general computation. It is the successor to WebGL and is what lets this site run a language model inside your browser.',
  },
  {
    q: 'Explain in a few paragraphs how a language model reads text.',
    a:
      'First the text is split into tokens: short pieces of words, each mapped to a number. A sentence like "The cat sat" becomes a handful of token IDs.\n\n' +
      'Each token ID is turned into a long list of numbers called an embedding. Position information is added so the model knows the order of the tokens.\n\n' +
      'The embeddings then pass through many transformer layers. In each layer, attention lets every token look at the tokens before it and decide which ones matter for understanding it. A pronoun can attend to the noun it refers to, for example.\n\n' +
      'After the last layer the model produces a score for every token in its vocabulary. Those scores become probabilities for the next token, one token is picked, appended to the text, and the whole process repeats. That loop is all "writing" is.',
  },
  {
    q: 'What time is it in Jakarta?',
    tool: { name: 'get_current_time', arguments: { timezone: 'Asia/Jakarta' }, result: { timezone: 'Asia/Jakarta', local: 'Friday, October 9, 2026 at 10:30:00 AM GMT+7', iso: '2026-10-09T03:30:00.000Z' } },
    a: "It's 10:30 in the morning in Jakarta.",
  },
  {
    q: 'Give me three tips for writing a good system prompt.',
    a: '1. Be specific: "answer in 2–3 sentences for a beginner" beats "be simple".\n2. Show an example of the output you want.\n3. Keep it short: it is sent with every single message.',
  },
]

const turnMessages = (t: Turn): Message[] =>
  t.tool
    ? [
        { role: 'user', content: t.q },
        { role: 'assistant', content: `<tool_call>${JSON.stringify({ name: t.tool.name, arguments: t.tool.arguments })}</tool_call>` },
        { role: 'user', content: formatToolResponse(t.tool.name, t.tool.result) },
        { role: 'assistant', content: t.a },
      ]
    : [{ role: 'user', content: t.q }, { role: 'assistant', content: t.a }]

/**
 * Append sample turns while they fit under `targetTokens` (≈, chars/4).
 * Starts with the facts turn on an empty chat. Returns the new history and the user/answer pairs to show in the chat.
 */
export function fillHistory(history: Message[], targetTokens: number): { history: Message[]; shown: Message[] } {
  const next = [...history]
  const shown: Message[] = []
  const add = (t: Turn) => {
    next.push(...turnMessages(t))
    shown.push({ role: 'user', content: t.q }, { role: 'assistant', content: t.a })
  }
  if (!history.length) add(FIRST)
  // Cycle through the filler, adding only turns that still fit; stop after a full round where nothing fit.
  // ponytail: capped at 2000 turns so a huge window can't freeze the tab (≈ 400k tokens)
  let used = historyTokens(next)
  for (let i = 0, misses = 0; misses < FILLER.length && i < 2000; i++) {
    const t = FILLER[i % FILLER.length]
    const cost = historyTokens(turnMessages(t))
    if (used + cost > targetTokens) {
      misses++
      continue
    }
    add(t)
    used += cost
    misses = 0
  }
  return { history: next, shown }
}
