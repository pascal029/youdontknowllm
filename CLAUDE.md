# youdontknowllm

Browser playground for learning how LLMs work: chat with a small model running locally (WebGPU) or any OpenAI-compatible API, edit the system prompt, add tools, and watch every agent step, context usage and tokens/sec.

## Commands
- `npm run dev` — dev server
- `npm run build` — typecheck + production build (must pass before every commit)
- `npm test` — vitest unit tests
- `npm run lint` — oxlint
- `npm run storybook` — component stories (Storybook)

## Stack
Vite + React + TypeScript, static SPA, no backend. Plain CSS, no UI library.
`@mlc-ai/web-llm` for local models (≤2B params only).

## Layout
- `src/llm/` — providers. One interface: OpenAI-style `chat.completions.create`. `webllm.ts` (local), `openai.ts` (remote via fetch + SSE), `models.ts` (the 5 bundled models), `types.ts`.
- `src/agent/` — `loop.ts` async generator yielding `Step` events; `parseToolCall.ts`.
- `src/tools/` — `builtin.ts`, `sandbox.ts` (Web Worker runner), `userTools.ts`.
- `src/components/` — UI. Components render state; logic lives in llm/agent/tools.
- `tests/` — vitest unit tests for pure logic (parser, sandbox, loop, providers).
- `src/components/X.tsx` sits next to `X.test.tsx` (React Testing Library) and `X.stories.tsx` (Storybook).
- `design-system/youdontknowllm/MASTER.md` — UI source of truth (ui-ux-pro-max).

## Design (ui-ux-pro-max)
Follow `design-system/youdontknowllm/MASTER.md`. Short version:
- Dark developer-tool look. Tokens live on `:root` in `src/index.css`: bg `#0F172A`, surface `#1E293B`, secondary `#334155`, muted `#272F42`, border `#475569`, fg `#F8FAFC`, accent/run `#22C55E`, destructive `#EF4444`, focus ring = accent.
- Inter for UI, JetBrains Mono for code, prompts, JSON and steps. Dense spacing scale (2/4/8/12/16/24/32px).
- Components use CSS variables only, never raw hex.
- SVG icons, never emoji. Visible focus rings, 150–300ms transitions, respect `prefers-reduced-motion`, contrast ≥ 4.5:1, works at 375px.

## Conventions
- Tool calling is prompt-based for all providers: tools described in the system prompt, model replies with `<tool_call>{"name":..., "arguments":{...}}</tool_call>`.
- Tool code always runs in a fresh Web Worker with a timeout, then `terminate()`. Never `eval` on the main thread.
- API keys live only in localStorage and are sent only to the user's own baseURL. Never log them.
- No new dependency when a few lines will do.

## Workflow
Work through `TODO.md` top to bottom. For each item: implement → add/update unit tests (+ a story for every UI component) → `npm test` and `npm run build` green → tick `[x]` → commit (conventional message) → push → next item.

Definition of done for an item: build green, tests green, new logic has a unit test, new component has a `.test.tsx` and a `.stories.tsx`.
