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
- [x] 1.4 OpenAI-compatible provider: baseURL + apiKey + model name, SSE streaming
- [x] 1.5 Provider settings UI: switch Local / OpenAI-compatible, persist in localStorage (key never logged)
- [x] 1.6 Basic streaming chat working end-to-end

## Phase 2 — System prompt
- [x] 2.1 System prompt editor with default prompt + reset button
- [x] 2.2 Show the final composed prompt (system + tool definitions) read-only

## Phase 3 — Function calling
- [x] 3.1 Tool definition type (name, description, JSON schema params, code)
- [x] 3.2 Tool-call prompt template + parser for <tool_call>{...}</tool_call> (+ unit tests)
- [x] 3.3 Worker sandbox runner with timeout + terminate (+ unit test)
- [x] 3.4 Built-in tools: calculator, get_current_time, random_number, run_javascript, wikipedia_search
- [x] 3.5 Tool toggle list (enable/disable per tool)
- [x] 3.6 User custom tool editor: name, description, params schema, JS body; validate JSON; persist
- [x] 3.7 Agent loop: model → parse tool call → execute → feed result → repeat (max 5 iterations)

## Phase 4 — Step-by-step visualizer
- [x] 4.1 Agent loop emits step events (user prompt, model output, tool chosen + args, tool result, final answer) — delivered with 3.7 (src/agent/loop.ts `Step`)
- [x] 4.2 StepTimeline component: expandable cards per step with raw JSON
- [x] 4.3 Highlight errors (parse failure, tool timeout) as steps

## Phase 5 — Stats
- [x] 5.1 Context window meter: tokens used / model context size
- [x] 5.2 Inference speed: prefill + decode tok/s
- [x] 5.3 StatsBar shows both live during generation

## Phase 6 — Polish
- [x] 6.1 Clear chat / new session
- [x] 6.2 README: what it is, how to run, browser requirements (WebGPU)
- [x] 6.3 Build passes, deploy-ready static output

## Phase 7 — SEO (site: https://youdontknowllm.netlify.app, hosted on Netlify)
- [x] 7.1 Multi-page setup: playground moves to /app/, Vite builds every *.html, SITE_URL in one place, netlify.toml
- [x] 7.2 Non-blocking fonts (<link> preconnect instead of CSS @import) + shared header/footer partials for static pages
- [x] 7.3 Static landing page / (no React): hero, what you'll learn, how it works, CTA to /app/, article links, full meta + JSON-LD
- [x] 7.4 Article template + /learn/ index + "Function calling" article
- [x] 7.5 Article: What is a token?
- [x] 7.6 Article: Context window
- [x] 7.7 Article: System prompt
- [x] 7.8 Article: Prefill vs decode (tokens/sec)
- [x] 7.9 Article: Run an LLM in your browser (WebGPU, ≤2B)
- [x] 7.10 Playground /app/ metadata (title, description, OG, SoftwareApplication JSON-LD)
- [x] 7.11 robots.txt, generated sitemap.xml, 1200×630 og:image, favicon, 404.html
- [x] 7.12 SEO test: every built page has title, description, canonical, og tags, one h1, valid JSON-LD, is in sitemap
- [x] 7.13 Lighthouse check on the built site (SEO 100, good CWV on landing) + Netlify deploy readiness

## Phase 8 — Redesign landing + learn (ui-ux-pro-max)
- [x] 8.1 Design direction: ui-ux-pro-max page overrides for landing + learn, marketing tokens (radius 16, hairline borders, glow, easing)
- [x] 8.2 Lessons as one source of truth (site.config LESSONS) → build-time lesson list, ItemList JSON-LD, prev/next (+ tests)
- [x] 8.3 Article prev/next navigation with lesson titles (replaces "Keep learning") + "Lesson n of 6 · x min read"
- [x] 8.4 Learn index redesign: numbered learning path
- [x] 8.5 Landing hero redesign: CSS-animated agent-loop demo window (no JS, reduced-motion safe)
- [x] 8.6 Landing sections redesign: bento "inside the model", how it works, learning path, FAQ, final CTA
- [x] 8.7 Header/footer refresh: sticky blurred header, active nav state, mobile layout
- [x] 8.8 QA: Lighthouse 100s + CLS 0, screenshots at 375/768/1440, SEO tests green

## Phase 9 — Model cleanup + tool modals (committed locally; push only when asked)
- [x] 9.1 Reusable Modal component (native <dialog>: Esc, backdrop click, focus, aria) + test + story
- [x] 9.2 Model cache helpers (isModelCached / deleteCachedModel via lazy WebLLM) + Provider.unload + tests
- [x] 9.3 Model picker: "Downloaded" status + Delete button with confirm modal (unloads the model if active)
- [x] 9.4 Tool editor in a modal: "Add tool" and "Edit" for custom tools (replaces inline editor)
- [x] 9.5 Built-in tools: "View code" read-only modal with Test run + example arguments
- [x] 9.6 Browser QA: delete flow, modals, keyboard + a11y — waived by user (laptop GPU can't run WebLLM); covered by component + App integration tests

## Phase 10 — Sampling options + lesson
- [x] 10.1 Plumbing: `Sampling` type (temperature, top_p, top_k, max_tokens, seed), `Provider.chat(messages, signal, sampling?)`, openai + webllm send only the keys that are set, runAgent passes it through (+ tests)
- [x] 10.2 State: `ydkl.sampling` in localStorage, wired into runAgent in App
- [x] 10.3 SamplingSettings component: collapsible, range + number per param, unset toggle, one-line hints, "may be rejected" note on top_k, reset, link to lesson (+ test + story)
- [x] 10.4 Lesson /learn/sampling/ "Temperature, top-p and top-k", placed right after "What is a token?" in LESSONS: distribution → temperature → top-k → top-p → seed → max_tokens, static SVG chart, try-it CTA
- [x] 10.5 QA: tests + build green, Lighthouse on the new page, real-model check (temp 0 + seed = same answer)
