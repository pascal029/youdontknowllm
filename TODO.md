# TODO

Each item = one commit + push. Every UI component ships with a `.test.tsx` and a `.stories.tsx`.

## Phase 0 — Setup
- [x] 0.0 Initial skeleton (git, CLAUDE.md, TODO.md, folders, design system)
- [x] 0.1 Install deps: @mlc-ai/web-llm
- [x] 0.2 Unit test setup: vitest + jsdom + React Testing Library, `npm test` script, 1 smoke test
- [x] 0.3 Storybook setup (react-vite), `npm run storybook` + `build-storybook`, global CSS loaded in preview
- [x] 0.4 Design tokens in src/index.css (colors, Inter + JetBrains Mono, spacing, focus ring, reduced-motion)
- [x] 0.5 App shell layout: sidebar (settings) + main (chat) + right panel (steps/stats), responsive (+ test + story)

## Phase 1 — LLM providers
- [x] 1.1 Define Provider interface + Message/Usage types (src/llm/types.ts)
- [x] 1.2 Model list: 5 ≤2B WebLLM models with size/context metadata (src/llm/models.ts)
- [x] 1.3 WebLLM provider: load model with download progress bar, WebGPU support check
- [ ] 1.4 OpenAI-compatible provider: baseURL + apiKey + model name, SSE streaming
- [ ] 1.5 Provider settings UI: switch Local / OpenAI-compatible, persist in localStorage (key never logged)
- [ ] 1.6 Basic streaming chat working end-to-end

## Phase 2 — System prompt
- [ ] 2.1 System prompt editor with default prompt + reset button
- [ ] 2.2 Show the final composed prompt (system + tool definitions) read-only

## Phase 3 — Function calling
- [ ] 3.1 Tool definition type (name, description, JSON schema params, code)
- [ ] 3.2 Tool-call prompt template + parser for <tool_call>{...}</tool_call> (+ unit tests)
- [ ] 3.3 Worker sandbox runner with timeout + terminate (+ unit test)
- [ ] 3.4 Built-in tools: calculator, get_current_time, random_number, run_javascript, wikipedia_search
- [ ] 3.5 Tool toggle list (enable/disable per tool)
- [ ] 3.6 User custom tool editor: name, description, params schema, JS body; validate JSON; persist
- [ ] 3.7 Agent loop: model → parse tool call → execute → feed result → repeat (max 5 iterations)

## Phase 4 — Step-by-step visualizer
- [ ] 4.1 Agent loop emits step events (user prompt, model output, tool chosen + args, tool result, final answer)
- [ ] 4.2 StepTimeline component: expandable cards per step with raw JSON
- [ ] 4.3 Highlight errors (parse failure, tool timeout) as steps

## Phase 5 — Stats
- [ ] 5.1 Context window meter: tokens used / model context size
- [ ] 5.2 Inference speed: prefill + decode tok/s
- [ ] 5.3 StatsBar shows both live during generation

## Phase 6 — Polish
- [ ] 6.1 Clear chat / new session
- [ ] 6.2 README: what it is, how to run, browser requirements (WebGPU)
- [ ] 6.3 Build passes, deploy-ready static output
