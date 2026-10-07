import { useRef, useState } from 'react'
import AppShell from './components/AppShell'
import Chat from './components/Chat'
import LoadProgress from './components/LoadProgress'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './components/ProviderSettings'
import SystemPromptEditor, { DEFAULT_SYSTEM_PROMPT } from './components/SystemPromptEditor'
import { useLocalStorage } from './hooks/useLocalStorage'
import { LOCAL_MODELS } from './llm/models'
import { createOpenAIProvider } from './llm/openai'
import type { Message, Provider } from './llm/types'
import { hasWebGPU } from './llm/webgpu'

export default function App() {
  const [settings, setSettings] = useLocalStorage('ydkl.provider', DEFAULT_PROVIDER_SETTINGS)
  const [prefs, setPrefs] = useLocalStorage('ydkl.prefs', { systemPrompt: DEFAULT_SYSTEM_PROMPT })
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState<{ progress: number; text: string } | null>(null)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState<string>()
  const abortRef = useRef<AbortController>(null)

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
      const sent: Message[] = prefs.systemPrompt.trim() ? [{ role: 'system', content: prefs.systemPrompt }, ...history] : history
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
