import AppShell from './components/AppShell'
import ProviderSettings, { DEFAULT_PROVIDER_SETTINGS } from './components/ProviderSettings'
import { useLocalStorage } from './hooks/useLocalStorage'
import { hasWebGPU } from './llm/webllm'

export default function App() {
  const [settings, setSettings] = useLocalStorage('ydkl.provider', DEFAULT_PROVIDER_SETTINGS)

  return (
    <AppShell
      sidebar={<ProviderSettings value={settings} onChange={setSettings} onActivate={() => {}} webgpu={hasWebGPU()} />}
      main={<p>Chat</p>}
      inspector={<p>Steps &amp; stats</p>}
    />
  )
}
