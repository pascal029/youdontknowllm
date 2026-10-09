# youdontknowllm

**Learn how LLMs actually work: in your browser, step by step.**

Chat with a small language model running entirely on your own GPU (no server, no account), or plug in any OpenAI-compatible API. Then look inside: edit the system prompt, give the model tools, and watch every step of the agent loop, the context window filling up and the tokens/sec.

## Features

- **Run a model in your browser**: 5 small models (≤2B params) via [WebLLM](https://github.com/mlc-ai/web-llm) + WebGPU. Downloaded once, then cached.

  | Model | Params | Download |
  |---|---|---|
  | Qwen3 0.6B | 0.6B | 1.4 GB |
  | Llama 3.2 1B Instruct | 1B | 0.9 GB |
  | Qwen2.5 1.5B Instruct | 1.5B | 1.6 GB |
  | SmolLM2 1.7B Instruct | 1.7B | 1.7 GB |
  | Qwen3 1.7B | 1.7B | 2.0 GB |

- **Or bring your own API**: any OpenAI-compatible `/chat/completions` endpoint (OpenAI, Ollama, LM Studio, vLLM, OpenRouter…).
- **Editable system prompt**: change the persona and see the answers change. The *full prompt* (system + tool instructions) is shown read-only so nothing is hidden.
- **Function calling**: 5 ready tools (`calculator`, `get_current_time`, `random_number`, `run_javascript`, `wikipedia_search`) plus your own custom tools (JSON Schema + JavaScript), with a **Test run** button.
- **Sandboxed tools**: tool code runs in a throwaway Web Worker with a 3s timeout. It has no DOM, no access to your API key, and no access to the model cache.
- **Step-by-step timeline**: your prompt → model output → tool chosen + arguments → tool result → final answer, with raw events and highlighted errors.
- **Sampling settings**: temperature, top-p, top-k, max tokens and seed. Anything left empty uses the model's default.
- **Context window meter**: tokens used / left, with warnings as it fills.
- **Compact the context**: drop old messages, remove tool traffic, summarize, or summary + recent messages, with a before/after view. **Fill context** adds a sample chat so you can try it straight away.
- **Inference speed**: prefill and decode tokens/sec, live while generating.
- **Reasoning models**: hidden "thinking" (e.g. Ollama `reasoning`) is shown as `<think>` in the timeline.

## Run it

```bash
npm install
npm run dev        # site: http://localhost:5173  ·  playground: http://localhost:5173/app/
```

### Browser requirements

- **In-browser models need WebGPU**: Chrome or Edge 113+ on Windows/macOS/ChromeOS works best. Firefox and Safari support is still partial.
- On **Linux**, WebGPU in Chrome is experimental. Some GPUs (e.g. Intel integrated) can hit *"GPU device lost"* while generating. The app detects this and asks you to reload; switching to an API always works.
- You need roughly as much free GPU memory as the model's download size.

### Using Ollama

1. Base URL: `http://<host>:11434/v1`. The API key can be empty. Model name: e.g. `gemma4:e2b`.
2. Ollama only accepts browser requests from allowed origins. `localhost` is allowed by default. If you serve the app from elsewhere, start Ollama with `OLLAMA_ORIGINS=https://your-site`.

### Using ollama.com (Ollama Cloud)

Base URL `https://ollama.com/v1`, your ollama.com API key, and a model such as `gpt-oss:20b`.

ollama.com doesn't allow requests from web pages (no CORS headers), so the app sends those requests to this site's `/relay/ollama/*` path instead. Netlify forwards them server-side (`netlify.toml`), and Vite does the same in `npm run dev` / `npm run preview`. Your key passes through that relay on the way to ollama.com and isn't stored. Only hosts listed in `RELAYED_ORIGINS` (`src/llm/relay.ts`) are relayed; everything else is called directly.

Tested with Groq (`https://api.groq.com/openai/v1`, `openai/gpt-oss-120b`), which allows browser requests, so no relay is needed.

Models like gpt-oss return native `tool_calls` instead of text. The app converts them into its `<tool_call>` format, so tools work the same way with every model.

## How tool calling works (the part you don't know)

Small models have no native "function calling". It is just text:

1. The tool list (name, description, JSON Schema) is appended to the system prompt, with the instruction to reply `<tool_call>{"name": …, "arguments": …}</tool_call>` when a tool is needed.
2. The app parses the reply (tolerating think blocks, code fences, a missing closing tag, and bare JSON).
3. The tool runs in the sandbox. The result is sent back as `<tool_response>…</tool_response>`.
4. The loop repeats until the model answers in plain text, or stops after 5 model calls.

All of it is visible in the **What happened** panel.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build to `dist/` (static, host anywhere) |
| `npm test` | Unit + component tests (Vitest + React Testing Library) |
| `npm run storybook` | Component stories at http://localhost:6006 |
| `npm run build-storybook` | Static Storybook to `storybook-static/` |
| `npm run lint` | oxlint |

## Privacy

Settings, the system prompt and custom tools are saved in your browser's localStorage. The API key is never saved: it's kept in memory until you reload, and sent only to the base URL you entered.
