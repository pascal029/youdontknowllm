import { useRef, useState } from 'react'
import { runAgent, type Step } from './agent/loop'
import { composeSystemPrompt } from './agent/prompt'
import AppShell from './components/AppShell'
import Chat from './components/Chat'
import ComposedPrompt from './components/ComposedPrompt'
import ContextMeter from './components/ContextMeter'
import LoadProgress from './components/LoadProgress'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './components/ProviderSettings'
import StepTimeline from './components/StepTimeline'
import SpeedStats from './components/SpeedStats'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './components/SystemPromptEditor'
import ToolEditor, { NEW_TOOL_TEMPLATE } from './components/ToolEditor'
import ToolList from './components/ToolList'
import { useLocalStorage } from './hooks/useLocalStorage'
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
  const ctxUsed = lastModel ? lastModel.usage.promptTokens + lastModel.usage.completionTokens : 0
  const [streaming, setStreaming] = useState<string>()
  const abortRef = useRef<AbortController>(null)
  // stored as { items } because useLocalStorage merges objects
  const [custom, setCustom] = useLocalStorage('ydkl.customTools', { items: [] as Tool[] })
  const [editing, setEditing] = useState<Tool | null>(null)
  const tools = [...BUILTIN_TOOLS, ...custom.items].map((t) => ({ ...t, enabled: !prefs.disabledTools.includes(t.name) }))
  const systemText = composeSystemPrompt(prefs.systemPrompt.trim(), tools.filter((t) => t.enabled))
  const toggleTool = (name: string, enabled: boolean) =>
    setPrefs({ ...prefs, disabledTools: enabled ? prefs.disabledTools.filter((n) => n !== name) : [...prefs.disabledTools, name] })

  async function activate() {
    setError('')
    try {
      if (settings.mode === 'remote') {
        setProvider(createOpenAIProvider(settings.remote))
        return
      }
      const model = LOCAL_MODELS.find((m) => m.id === settings.localModelId) ?? LOCAL_MODELS[0]
      setLoading({ progress: 0, text: 'Starting…' })
      const { loadWebLLM } = await import('./llm/webllm')
      setProvider(await loadWebLLM(model, (r) => setLoading({ progress: r.progress, text: r.text })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
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
          continue
        }
        setSteps((s) => [...s, e])
        if (e.type === 'model') {
          setStreaming('')
          setLastModel(e)
        }
        if (e.type === 'answer') setMessages((m) => [...m, { role: 'assistant', content: e.text }])
        if (e.type === 'error') setError(e.error)
      }
    } catch (e) {
      if (!ac.signal.aborted) {
        const msg = e instanceof Error ? e.message : String(e)
        if (settings.mode === 'local') {
          // A WebGPU failure (e.g. device lost) leaves the engine unusable; make the user reload it.
          setProvider(null)
          setError(`Local model stopped: ${msg} Reload the model, try a smaller one, or use an API.`)
        } else setError(msg)
      }
    } finally {
      setStreaming(undefined)
    }
  }

  return (
    <AppShell
      sidebar={
        <>
          <ProviderSettings value={settings} onChange={setSettings} onActivate={activate} busy={!!loading} webgpu={hasWebGPU()} />
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
              onDelete={(t) => setCustom({ items: custom.items.filter((x) => x.name !== t.name) })}
            />
            {editing ? (
              <ToolEditor
                key={editing.name}
                initial={editing}
                takenNames={tools.map((t) => t.name).filter((n) => n !== editing.name || editing === NEW_TOOL_TEMPLATE)}
                onCancel={() => setEditing(null)}
                onSave={(t) => {
                  const rest = editing === NEW_TOOL_TEMPLATE ? custom.items : custom.items.filter((x) => x.name !== editing.name)
                  setCustom({ items: [...rest, t] })
                  setEditing(null)
                }}
              />
            ) : (
              <button type="button" className="btn btn--sm add-tool" onClick={() => setEditing(NEW_TOOL_TEMPLATE)}>+ Add tool</button>
            )}
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
        />
      }
      inspector={
        <>
          {provider && (
            <section aria-label="Stats" className="stats">
              <ContextMeter used={ctxUsed} total={provider.contextWindow} />
              {lastModel && <SpeedStats usage={lastModel.usage} ms={lastModel.ms} />}
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
