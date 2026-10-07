import { useCallback, useEffect, useRef, useState } from 'react'
import { runAgent, type Step } from './agent/loop'
import { composeSystemPrompt } from './agent/prompt'
import AppShell from './components/AppShell'
import Chat from './components/Chat'
import ComposedPrompt from './components/ComposedPrompt'
import ContextMeter from './components/ContextMeter'
import LoadProgress from './components/LoadProgress'
import Modal from './components/Modal'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './components/ProviderSettings'
import StepTimeline from './components/StepTimeline'
import SpeedStats, { liveRate, type LiveSpeed } from './components/SpeedStats'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './components/SystemPromptEditor'
import ToolEditor, { NEW_TOOL_TEMPLATE } from './components/ToolEditor'
import ToolList from './components/ToolList'
import { useLocalStorage } from './hooks/useLocalStorage'
import { cachedModelIds, deleteCachedModel } from './llm/cache'
import { LOCAL_MODELS } from './llm/models'
import { createOpenAIProvider } from './llm/openai'
import type { Message, Provider } from './llm/types'
import { hasWebGPU } from './llm/webgpu'
import { BUILTIN_TOOLS } from './tools/builtin'
import type { Tool } from './tools/types'

export default function App() {
  const [settings, setSettings] = useLocalStorage('ydkl.provider', DEFAULT_PROVIDER_SETTINGS)
  const [prefs, setPrefs] = useLocalStorage('ydkl.prefs', { systemPrompt: DEFAULT_SYSTEM_PROMPT, disabledTools: [] as string[] })
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState<{ progress: number; text: string } | null>(null)
  const [error, setError] = useState('')
  /** what the model sees next turn (includes tool calls/responses) */
  const [history, setHistory] = useState<Message[]>([])
  /** what the chat shows: user messages + final answers */
  const [messages, setMessages] = useState<Message[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  /** last model call: drives context + speed stats, carries over between turns */
  const [lastModel, setLastModel] = useState<Extract<Step, { type: 'model' }> | null>(null)
  const [live, setLive] = useState<LiveSpeed>()
  const liveRef = useRef({ first: 0, tokens: 0 })
  const ctxUsed = (lastModel ? lastModel.usage.promptTokens + lastModel.usage.completionTokens : 0) + (live?.tokens ?? 0)
  const [streaming, setStreaming] = useState<string>()
  const abortRef = useRef<AbortController>(null)
  // stored as { items } because useLocalStorage merges objects
  const [custom, setCustom] = useLocalStorage('ydkl.customTools', { items: [] as Tool[] })
  const [editing, setEditing] = useState<Tool | null>(null)
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
    cachedModelIds(LOCAL_MODELS.map((m) => m.id)).then(setCached, () => setCached(new Set()))
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
    try {
      const gen = runAgent({ provider, systemPrompt: prefs.systemPrompt, tools: tools.filter((t) => t.enabled), history, userText: text, signal: ac.signal })
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
          setStreaming('')
          setLastModel(e)
          liveRef.current = { first: 0, tokens: 0 }
          setLive(undefined)
        }
        if (e.type === 'answer') setMessages((m) => [...m, { role: 'assistant', content: e.text }])
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
    setError('')
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
          <SystemPromptEditor value={prefs.systemPrompt} onChange={(systemPrompt) => setPrefs({ ...prefs, systemPrompt })} />
          <section aria-labelledby="tools-title">
            <h2 id="tools-title" className="panel-title">Tools</h2>
            <ToolList
              tools={tools}
              onToggle={toggleTool}
              onEdit={setEditing}
              onDelete={setDeletingTool}
            />
            <button type="button" className="btn btn--sm add-tool" onClick={() => setEditing(NEW_TOOL_TEMPLATE)}>+ Add tool</button>
            <Modal
              open={!!editing}
              size="lg"
              title={editing === NEW_TOOL_TEMPLATE ? 'Add tool' : `Edit ${editing?.name ?? ''}`}
              onClose={() => setEditing(null)}
            >
              {editing && (
                <ToolEditor
                  initial={editing}
                  takenNames={tools.map((t) => t.name).filter((n) => n !== editing.name || editing === NEW_TOOL_TEMPLATE)}
                  onCancel={() => setEditing(null)}
                  onSave={(t) => {
                    const rest = editing === NEW_TOOL_TEMPLATE ? custom.items : custom.items.filter((x) => x.name !== editing.name)
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
              {(lastModel || live) && <SpeedStats usage={lastModel?.usage ?? { promptTokens: 0, completionTokens: 0 }} ms={lastModel?.ms ?? 0} live={live} />}
            </section>
          )}
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="panel-title">What happened</h2>
            <StepTimeline steps={steps} streaming={streaming} />
          </section>
        </>
      }
    />
  )
}
