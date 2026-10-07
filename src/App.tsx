import { useRef, useState } from 'react'
import { composeSystemPrompt } from './agent/prompt'
import AppShell from './components/AppShell'
import Chat from './components/Chat'
import ComposedPrompt from './components/ComposedPrompt'
import LoadProgress from './components/LoadProgress'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './components/ProviderSettings'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './components/SystemPromptEditor'
import ToolList from './components/ToolList'
import { useLocalStorage } from './hooks/useLocalStorage'
import { LOCAL_MODELS } from './llm/models'
import { createOpenAIProvider } from './llm/openai'
import type { Message, Provider } from './llm/types'
import { hasWebGPU } from './llm/webgpu'
import { BUILTIN_TOOLS } from './tools/builtin'

export default function App() {
  const [settings, setSettings] = useLocalStorage('ydkl.provider', DEFAULT_PROVIDER_SETTINGS)
  const [prefs, setPrefs] = useLocalStorage('ydkl.prefs', { systemPrompt: DEFAULT_SYSTEM_PROMPT, disabledTools: [] as string[] })
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState<{ progress: number; text: string } | null>(null)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState<string>()
  const abortRef = useRef<AbortController>(null)
  const tools = BUILTIN_TOOLS.map((t) => ({ ...t, enabled: !prefs.disabledTools.includes(t.name) }))
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
    const history: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setStreaming('')
    setError('')
    const ac = new AbortController()
    abortRef.current = ac
    let out = ''
    try {
      const sent: Message[] = systemText ? [{ role: 'system', content: systemText }, ...history] : history
      for await (const c of provider.chat(sent, ac.signal)) {
        if (c.type === 'delta') setStreaming((out += c.text))
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
      if (out) setMessages([...history, { role: 'assistant', content: out }])
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
            <ToolList tools={tools} onToggle={toggleTool} />
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
      inspector={<p>Steps &amp; stats</p>}
    />
  )
}
