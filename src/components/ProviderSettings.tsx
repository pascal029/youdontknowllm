import { LOCAL_MODELS } from '../llm/models'
import type { RemoteConfig } from '../llm/openai'
import './ProviderSettings.css'

export type ProviderSettingsValue = {
  mode: 'local' | 'remote'
  localModelId: string
  remote: RemoteConfig
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettingsValue = {
  mode: 'local',
  localModelId: LOCAL_MODELS[0].id,
  remote: { baseURL: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', contextWindow: 8192 },
}

type Props = {
  value: ProviderSettingsValue
  onChange: (v: ProviderSettingsValue) => void
  onActivate: () => void
  busy?: boolean
  webgpu: boolean
}

export default function ProviderSettings({ value, onChange, onActivate, busy, webgpu }: Props) {
  const set = (patch: Partial<ProviderSettingsValue>) => onChange({ ...value, ...patch })
  const setRemote = (patch: Partial<RemoteConfig>) => set({ remote: { ...value.remote, ...patch } })
  const model = LOCAL_MODELS.find((m) => m.id === value.localModelId) ?? LOCAL_MODELS[0]
  const remoteReady = value.remote.baseURL.trim() && value.remote.model.trim()

  return (
    <section className="provider" aria-labelledby="provider-title">
      <h2 id="provider-title" className="panel-title">Model</h2>

      <div className="segmented" role="radiogroup" aria-label="Where the model runs">
        {(['local', 'remote'] as const).map((mode) => (
          <label key={mode} className="segmented__opt">
            <input type="radio" name="provider-mode" value={mode} checked={value.mode === mode} onChange={() => set({ mode })} />
            <span>{mode === 'local' ? 'In browser' : 'OpenAI-compatible'}</span>
          </label>
        ))}
      </div>

      {value.mode === 'local' ? (
        <>
          <div className="field">
            <label>
              <span>Local model</span>
              <select value={model.id} onChange={(e) => set({ localModelId: e.target.value })}>
                {LOCAL_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {(m.sizeMB / 1024).toFixed(1)} GB
                  </option>
                ))}
              </select>
            </label>
            <small>{model.note} Context {model.contextWindow.toLocaleString()} tokens. Downloaded once, then cached.</small>
          </div>
          {!webgpu && <p className="error-text">WebGPU not available. Use Chrome/Edge, or switch to OpenAI-compatible.</p>}
          <button className="btn btn--primary" onClick={onActivate} disabled={busy || !webgpu}>
            {busy ? 'Loading…' : 'Load model'}
          </button>
        </>
      ) : (
        <>
          <label className="field">
            <span>Base URL</span>
            <input type="url" value={value.remote.baseURL} onChange={(e) => setRemote({ baseURL: e.target.value })} placeholder="https://api.openai.com/v1" />
          </label>
          <div className="field">
            <label>
              <span>API key</span>
              <input type="password" autoComplete="off" value={value.remote.apiKey} onChange={(e) => setRemote({ apiKey: e.target.value })} />
            </label>
            <small>Stored only in this browser. Sent only to the base URL above.</small>
          </div>
          <label className="field">
            <span>Model name</span>
            <input value={value.remote.model} onChange={(e) => setRemote({ model: e.target.value })} />
          </label>
          <label className="field">
            <span>Context window (tokens)</span>
            <input type="number" min={512} step={512} value={value.remote.contextWindow} onChange={(e) => setRemote({ contextWindow: Number(e.target.value) || 0 })} />
          </label>
          <button className="btn btn--primary" onClick={onActivate} disabled={busy || !remoteReady}>
            Connect
          </button>
        </>
      )}
    </section>
  )
}
