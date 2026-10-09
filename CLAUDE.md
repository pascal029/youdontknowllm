# youdontknowllm

Browser playground for learning how LLMs work: chat with a small model running locally (WebGPU) or any OpenAI-compatible API, edit the system prompt, add tools, and watch every agent step, context usage and tokens/sec.

## Commands
- `npm run dev` — dev server
- `npm run build` — typecheck + production build (must pass before every commit)
- `npm test` — vitest + React Testing Library
- `npm run lint` — oxlint
- `npm run storybook` / `npm run build-storybook` — component stories

## Stack
Vite + React + TypeScript, no backend. Multi-page static site: `/` and `/learn/*` are plain HTML (SEO), `/app/` is the React playground. Every `*.html` outside src/public/dist is a build entry (`findPages` in vite.config.ts). Public URL lives in `site.config.ts`. Hosted on Netlify (`netlify.toml`). Plain CSS, no UI library.
`@mlc-ai/web-llm` for local models (≤2B params only).

## Layout
- `src/llm/` — providers behind one interface: `Provider.chat(messages, signal)` → async stream of `delta` / `done(usage)` (`types.ts`). `webllm.ts` (local, engine in `webllm.worker.ts`, lazy-loaded), `openai.ts` (fetch + SSE, measures speed when the server doesn't), `stream.ts` (OpenAI chunks → our stream, inlines reasoning as `<think>`), `models.ts` (the 5 bundled models), `webgpu.ts`.
- `src/agent/` — `loop.ts` (`runAgent` async generator yielding `Step` events + deltas), `parseToolCall.ts`, `prompt.ts` (system prompt + tool instructions, tool response format).
- `src/tools/` — `builtin.ts` (5 tools as JS strings), `sandbox.ts` (Web Worker runner), `types.ts` (`Tool` + `validateTool`).
- `src/components/` — UI, one folder per component: `Name/index.tsx`, `index.css`, `index.test.tsx`, `index.stories.tsx`. Components render state; logic lives in llm/agent/tools. `App.tsx` wires it together.
- `src/hooks/useLocalStorage.ts` — persistence (merges object defaults, so store arrays as `{ items }`).
- Tests sit next to the code: `X.test.ts` (components: `Name/index.test.tsx`). `src/test-fake-worker.ts` runs the real sandbox source in jsdom.
- Every component has `Name/index.stories.tsx` (Storybook).
- `design-system/youdontknowllm/MASTER.md` — UI source of truth (ui-ux-pro-max).

## Design (ui-ux-pro-max)
Follow `design-system/youdontknowllm/MASTER.md`. Short version:
- Light cream/green palette (user-chosen): `#FBF5DD` cream bg, `#E7E1B1` khaki secondary, `#306D29` green accent, `#0D530E` dark green text/hover. Tokens live on `:root` in `src/index.css` (derived: surface `#FDFAEE`, muted `#F0EAC5`, border `#B9C48F`, fg-muted `#41773C`); site-only tokens (hairlines, glass, glows) at the top of `src/site/site.css`. Focus ring = accent.
- Lora for all text (site + app, user-chosen; `--font-text` with a metric-matched 'Lora Fallback'), JetBrains Mono for code, prompts, JSON and steps. Dense spacing scale (2/4/8/12/16/24/32px).
- Components use CSS variables only, never raw hex.
- SVG icons, never emoji. Visible focus rings, 150–300ms transitions, respect `prefers-reduced-motion`, contrast ≥ 4.5:1, works at 375px.

## Conventions
- Tool calling is prompt-based for all providers: tools described in the system prompt, model replies with `<tool_call>{"name":..., "arguments":{...}}</tool_call>`.
- Tool code always runs in a fresh Web Worker with a timeout, then `terminate()`. Never `eval` on the main thread.
- API keys live only in localStorage and are sent only with requests to the user's baseURL. Exception: hosts in `RELAYED_ORIGINS` (`src/llm/relay.ts`, e.g. ollama.com, which has no CORS) go through this site's Netlify/Vite relay; the UI says so. Never log keys.
- Native `tool_calls` from a server are converted to `<tool_call>` text in `stream.ts`, so the prompt-based tool pipeline handles every model. Errors sent inside a stream are raised; Groq's `tool_use_failed` (gpt-oss called a tool without a native `tools` list) is recovered from `failed_generation`. `parseToolCall` also unwraps `{"name":"tool_call",...}` and, when a reply has no visible text, finds a call hidden in the thinking.
- No new dependency when a few lines will do.

## Workflow
Work through `TODO.md` top to bottom. For each item: implement → add/update unit tests (+ a story for every UI component) → `npm test` and `npm run build` green → tick `[x]` → commit (conventional message) → push → next item.

Definition of done for an item: build green, tests green, new logic has a unit test, new component has a `.test.tsx` and a `.stories.tsx`.

## Testing against a real model
- Remote: an Ollama server works as OpenAI-compatible at `http://<host>:11434/v1` (CORS allows localhost).
- Local WebLLM needs a working WebGPU device; on Linux + Intel iGPU it can hit "device lost" (environment limit, not an app bug).
