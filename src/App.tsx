import { useCallback, useEffect, useRef, useState } from 'react'
import { estimateTokens, historyTokens, summarize } from './agent/compact'
import { runAgent, type Step } from './agent/loop'
import { fillHistory } from './agent/sampleChat'
import { composeSystemPrompt } from './agent/prompt'
import { splitThink } from './agent/parseToolCall'
import AppShell from './components/AppShell'
import Chat, { type ChatMessage } from './components/Chat'
import ComposedPrompt from './components/ComposedPrompt'
import ContextCompactor from './components/ContextCompactor'
import ContextMeter from './components/ContextMeter'
import LoadProgress from './components/LoadProgress'
import Modal from './components/Modal'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './components/ProviderSettings'
import StepTimeline from './components/StepTimeline'
import SpeedStats, { liveRate, type LiveSpeed } from './components/SpeedStats'
import SamplingSettings from './components/SamplingSettings'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './components/SystemPromptEditor'
import ToolEditor, { NEW_TOOL_TEMPLATE } from './components/ToolEditor'
import ToolList from './components/ToolList'
import { useLocalStorage } from './hooks/useLocalStorage'
import { cachedModelIds, deleteCachedModel } from './llm/cache'
import { LOCAL_MODELS } from './llm/models'
import { createOpenAIProvider } from './llm/openai'
import type { Message, Provider, Sampling } from './llm/types'
import { hasWebGPU } from './llm/webgpu'
import { BUILTIN_TOOLS } from './tools/builtin'
import type { Tool } from './tools/types'

export default function App() {
  const [settings, setSettings] = useLocalStorage('ydkl.provider', DEFAULT_PROVIDER_SETTINGS)
  const [prefs, setPrefs] = useLocalStorage('ydkl.prefs', { systemPrompt: DEFAULT_SYSTEM_PROMPT, disabledTools: [] as string[] })
  const [sampling, setSampling] = useLocalStorage<Sampling>('ydkl.sampling', {})
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState<{ progress: number; text: string } | null>(null)
  const [error, setError] = useState('')
  /** what the model sees next turn (includes tool calls/responses) */
  const [history, setHistory] = useState<Message[]>([])
  /** what the chat shows: user messages + final answers */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  /** last model call: drives context + speed stats, carries over between turns */
  const [lastModel, setLastModel] = useState<Extract<Step, { type: 'model' }> | null>(null)
  const [live, setLive] = useState<LiveSpeed>()
  const liveRef = useRef({ first: 0, tokens: 0 })
  /** after compacting: estimated size until the next model call reports real usage */
  const [ctxEstimate, setCtxEstimate] = useState<number | null>(null)
  const [compactOpen, setCompactOpen] = useState(false)
  const ctxUsed = (ctxEstimate ?? (lastModel ? lastModel.usage.promptTokens + lastModel.usage.completionTokens : 0)) + (live?.tokens ?? 0)
  const [streaming, setStreaming] = useState<string>()
  const abortRef = useRef<AbortController>(null)
  // stored as { items } because useLocalStorage merges objects
  const [custom, setCustom] = useLocalStorage('ydkl.customTools', { items: [] as Tool[] })
  /** tool open in the editor modal; isNew = Add or Duplicate (save appends instead of replacing) */
  const [editing, setEditing] = useState<{ tool: Tool; isNew: boolean } | null>(null)
  const [deletingTool, setDeletingTool] = useState<Tool | null>(null)
  const tools = [...BUILTIN_TOOLS, ...custom.items].map((t) => ({ ...t, enabled: !prefs.disabledTools.includes(t.name) }))
  const systemText = composeSystemPrompt(prefs.systemPrompt.trim(), tools.filter((t) => t.enabled))
  const toggleTool = (name: string, enabled: boolean) =>
    setPrefs({ ...prefs, disabledTools: enabled ? prefs.disabledTools.filter((n) => n !== name) : [...prefs.disabledTools, name] })

  const webgpu = hasWebGPU()
  /** local model ids already in the browser cache (undefined = not checked yet) */
  const [cached, setCached] = useState<Set<string>>()
  const [activeModelId, setActiveModelId] = useState<string>()

  const refreshCached = useCallback(() => {
    // a failed check means "unknown", not "not downloaded": hide the status rather than guess
    cachedModelIds(LOCAL_MODELS.map((m) => m.id)).then(setCached, () => setCached(undefined))
  }, [])

  useEffect(() => {
    if (settings.mode === 'local' && webgpu) refreshCached()
  }, [settings.mode, webgpu, refreshCached])

  /** Free the current model (GPU memory + worker) before replacing or deleting it. */
  async function dropProvider() {
    await provider?.unload?.()
    setProvider(null)
    setActiveModelId(undefined)
  }

  async function activate() {
    setError('')
    try {
      await dropProvider()
      if (settings.mode === 'remote') {
        setProvider(createOpenAIProvider(settings.remote))
        return
      }
      const model = LOCAL_MODELS.find((m) => m.id === settings.localModelId) ?? LOCAL_MODELS[0]
      setLoading({ progress: 0, text: 'Starting…' })
      const { loadWebLLM } = await import('./llm/webllm')
      setProvider(await loadWebLLM(model, (r) => setLoading({ progress: r.progress, text: r.text })))
      setActiveModelId(model.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
      if (settings.mode === 'local') refreshCached()
    }
  }

  async function deleteModel(id: string) {
    if (activeModelId === id) await dropProvider()
    await deleteCachedModel(id)
    refreshCached()
  }

  async function send(text: string) {
    if (!provider) return
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSteps([])
    setStreaming('')
    setError('')
    const ac = new AbortController()
    abortRef.current = ac
    // reasoning from every model call this turn, shown collapsed above the answer
    const thoughts: string[] = []
    try {
      const gen = runAgent({ provider, systemPrompt: prefs.systemPrompt, tools: tools.filter((t) => t.enabled), history, userText: text, signal: ac.signal, sampling })
      for (;;) {
        const r = await gen.next()
        if (r.done) {
          setHistory(r.value)
          break
        }
        const e = r.value
        if (e.type === 'delta') {
          setStreaming((s) => (s ?? '') + e.text)
          // ~1 streamed chunk per token for WebLLM and most OpenAI-compatible servers
          const now = performance.now()
          const l = liveRef.current
          if (!l.first) l.first = now
          l.tokens++
          setLive({ tokens: l.tokens, tps: liveRate(l.tokens, l.first, now) })
          continue
        }
        setSteps((s) => [...s, e])
        if (e.type === 'model') {
          const { thinking } = splitThink(e.text)
          if (thinking) thoughts.push(thinking)
          setStreaming('')
          setLastModel(e)
          setCtxEstimate(null)
          liveRef.current = { first: 0, tokens: 0 }
          setLive(undefined)
        }
        if (e.type === 'answer') setMessages((m) => [...m, { role: 'assistant', content: e.text, thinking: thoughts.join('\n\n') || undefined }])
        if (e.type === 'error') setError(e.error)
      }
    } catch (e) {
      if (!ac.signal.aborted) {
        const msg = e instanceof Error ? e.message : String(e)
        if (settings.mode === 'local') {
          // A WebGPU failure (e.g. device lost) leaves the engine unusable; make the user reload it.
          void dropProvider()
          setError(`Local model stopped: ${msg} Reload the model, try a smaller one, or use an API.`)
        } else setError(msg)
      }
    } finally {
      setStreaming(undefined)
      liveRef.current = { first: 0, tokens: 0 }
      setLive(undefined)
    }
  }

  function newChat() {
    abortRef.current?.abort()
    setHistory([])
    setMessages([])
    setSteps([])
    setLastModel(null)
    setCtxEstimate(null)
    setError('')
  }

  /** Replace what the model re-reads; the visible chat keeps every message plus a notice. */
  function compact(next: Message[], label: string) {
    const sys = estimateTokens(systemText)
    const before = sys + historyTokens(history)
    const after = sys + historyTokens(next)
    setHistory(next)
    setCtxEstimate(after)
    setMessages((m) => [
      ...m,
      { role: 'notice', content: `Context compacted (${label}): ≈${before.toLocaleString()} → ≈${after.toLocaleString()} tokens. Messages above stay visible, but the model no longer sees all of them as written.` },
    ])
    setCompactOpen(false)
  }

  /** Learning shortcut: append a sample chat up to ~80% of the window, so compacting can be tried right away. */
  function fillContext(contextWindow: number) {
    const sys = estimateTokens(systemText)
    const { history: next, shown } = fillHistory(history, Math.round(contextWindow * 0.8) - sys)
    const after = sys + historyTokens(next)
    setHistory(next)
    setCtxEstimate(after)
    setMessages((m) => [
      ...m,
      { role: 'notice', content: `Added a sample conversation: context is now ≈${after.toLocaleString()} tokens. Your next message sends all of it. Try "Compact context…".` },
      ...shown,
    ])
  }

  return (
    <AppShell
      sidebar={
        <>
          <ProviderSettings
            value={settings}
            onChange={setSettings}
            onActivate={activate}
            busy={!!loading}
            webgpu={webgpu}
            cached={cached}
            activeModelId={activeModelId}
            onDelete={deleteModel}
          />
          {loading && <LoadProgress {...loading} />}
          {provider && !loading && <p className="status-ok">Ready: {provider.name}</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
          <SamplingSettings value={sampling} onChange={setSampling} />
          <SystemPromptEditor value={prefs.systemPrompt} onChange={(systemPrompt) => setPrefs({ ...prefs, systemPrompt })} />
          <section aria-labelledby="tools-title">
            <h2 id="tools-title" className="panel-title">Tools</h2>
            <ToolList
              tools={tools}
              onToggle={toggleTool}
              onEdit={(tool) => setEditing({ tool, isNew: false })}
              onDelete={setDeletingTool}
            />
            <button type="button" className="btn btn--sm add-tool" onClick={() => setEditing({ tool: NEW_TOOL_TEMPLATE, isNew: true })}>+ Add tool</button>
            <Modal
              open={!!editing}
              size="lg"
              title={!editing ? '' : editing.isNew ? 'Add tool' : editing.tool.builtin ? `${editing.tool.name} (built-in)` : `Edit ${editing.tool.name}`}
              onClose={() => setEditing(null)}
            >
              {editing && (
                <ToolEditor
                  key={`${editing.tool.name}-${editing.isNew}`}
                  initial={editing.tool}
                  readOnly={editing.tool.builtin && !editing.isNew}
                  onDuplicate={() =>
                    setEditing({ tool: { ...editing.tool, name: `${editing.tool.name}_copy`, builtin: false, enabled: true }, isNew: true })
                  }
                  takenNames={tools.map((t) => t.name).filter((n) => editing.isNew || n !== editing.tool.name)}
                  onCancel={() => setEditing(null)}
                  onSave={(t) => {
                    const rest = editing.isNew ? custom.items : custom.items.filter((x) => x.name !== editing.tool.name)
                    setCustom({ items: [...rest, t] })
                    setEditing(null)
                  }}
                />
              )}
            </Modal>
            <Modal
              open={!!deletingTool}
              size="sm"
              title={`Delete ${deletingTool?.name ?? ''}?`}
              onClose={() => setDeletingTool(null)}
              footer={
                <>
                  <button type="button" className="btn btn--ghost" onClick={() => setDeletingTool(null)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn--danger-solid"
                    onClick={() => {
                      setCustom({ items: custom.items.filter((x) => x.name !== deletingTool?.name) })
                      setDeletingTool(null)
                    }}
                  >
                    Delete tool
                  </button>
                </>
              }
            >
              <p className="modal-text">This removes the tool and its code from this browser. It can't be undone.</p>
            </Modal>
          </section>
          <ComposedPrompt text={systemText} />
        </>
      }
      main={
        <Chat
          messages={messages}
          streaming={streaming}
          busy={streaming !== undefined}
          disabled={!provider}
          disabledReason="Load a model or connect an API to start."
          onSend={send}
          onStop={() => abortRef.current?.abort()}
          onClear={newChat}
        />
      }
      inspector={
        <>
          {provider && (
            <section aria-label="Stats" className="stats">
              <ContextMeter used={ctxUsed} total={provider.contextWindow} />
              <div className="ctx-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => fillContext(provider.contextWindow)}
                  disabled={streaming !== undefined}
                  title="Add a sample conversation (facts, tool calls, a big tool result) up to ~80% of the window"
                >
                  Fill context
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setCompactOpen(true)} disabled={!history.length || streaming !== undefined}>
                  Compact context…
                </button>
              </div>
              {provider.contextWindow > 16384 && (
                <small className="ctx-tip">Tip: lower the context window in settings (e.g. 8192) so a full window stays cheap and under API rate limits.</small>
              )}
              {(lastModel || live) && <SpeedStats usage={lastModel?.usage ?? { promptTokens: 0, completionTokens: 0 }} ms={lastModel?.ms ?? 0} live={live} />}
            </section>
          )}
          <Modal open={compactOpen} size="lg" title="Compact the context window" onClose={() => setCompactOpen(false)}>
            {provider && (
              <ContextCompactor
                history={history}
                systemTokens={estimateTokens(systemText)}
                contextWindow={provider.contextWindow}
                local={settings.mode === 'local'}
                summarize={(h, keepLast, signal) => summarize(provider, h, { keepLast, sampling, signal })}
                onApply={compact}
                onCancel={() => setCompactOpen(false)}
              />
            )}
          </Modal>
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="panel-title">What happened</h2>
            <StepTimeline steps={steps} streaming={streaming} />
          </section>
        </>
      }
    />
  )
}
