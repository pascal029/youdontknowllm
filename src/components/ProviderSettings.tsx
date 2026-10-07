import { useState } from 'react'
import { LOCAL_MODELS } from '../llm/models'
import type { RemoteConfig } from '../llm/openai'
import Modal from './Modal'
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
  /** local model ids already downloaded; undefined while checking */
  cached?: Set<string>
  /** id of the local model currently loaded, if any */
  activeModelId?: string
  /** delete a downloaded model from the browser cache */
  onDelete?: (id: string) => Promise<void>
}

const gb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`

export default function ProviderSettings({ value, onChange, onActivate, busy, webgpu, cached, activeModelId, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const set = (patch: Partial<ProviderSettingsValue>) => onChange({ ...value, ...patch })
  const setRemote = (patch: Partial<RemoteConfig>) => set({ remote: { ...value.remote, ...patch } })
  const model = LOCAL_MODELS.find((m) => m.id === value.localModelId) ?? LOCAL_MODELS[0]
  const remoteReady = value.remote.baseURL.trim() && value.remote.model.trim()
  const isCached = cached?.has(model.id)

  const confirmDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete(model.id)
      setConfirming(false)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="provider" aria-labelledby="provider-title">
      <h2 id="provider-title" className="panel-title">Model</h2>
      <p className="provider__hint">Run a small model in your browser, or use any OpenAI-compatible API.</p>

      <div className="segmented" role="radiogroup" aria-label="Where the model runs">
        {(['local', 'remote'] as const).map((mode) => (
          <label key={mode} className="segmented__opt">
            <input type="radio" name="provider-mode" value={mode} checked={value.mode === mode} onChange={() => set({ mode })} />
            <span>{mode === 'local' ? 'In browser' : 'API'}</span>
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
                    {m.label} · {gb(m.sizeMB)}{cached?.has(m.id) ? ' · downloaded' : ''}
                  </option>
                ))}
              </select>
            </label>
            <small>{model.note} Context {model.contextWindow.toLocaleString()} tokens.</small>
          </div>
          {webgpu && cached && (
            <div className="model-status">
              {isCached ? (
                <>
                  <span className="model-status__pill model-status__pill--ok">Downloaded · {gb(model.sizeMB)}</span>
                  {onDelete && (
                    <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => setConfirming(true)} aria-label={`Delete ${model.label} from this browser`}>
                      Delete
                    </button>
                  )}
                </>
              ) : (
                <span className="model-status__pill">Not downloaded · {gb(model.sizeMB)} download</span>
              )}
            </div>
          )}
          {!webgpu && <p className="error-text">WebGPU not available. Use Chrome/Edge, or switch to OpenAI-compatible.</p>}
          <button className="btn btn--primary" onClick={onActivate} disabled={busy || !webgpu}>
            {busy ? 'Loading…' : isCached || !cached ? 'Load model' : `Download & load (${gb(model.sizeMB)})`}
          </button>
          <Modal
            open={confirming}
            size="sm"
            title={`Delete ${model.label}?`}
            onClose={() => !deleting && setConfirming(false)}
            footer={
              <>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</button>
                <button type="button" className="btn btn--danger-solid" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete model'}
                </button>
              </>
            }
          >
            <p className="modal-text">This removes the downloaded model (about {gb(model.sizeMB)}) from this browser. You can download it again any time.</p>
            {activeModelId === model.id && <p className="modal-text">It's loaded right now, so it will be unloaded first.</p>}
            {deleteError && <p className="error-text" role="alert">Couldn't delete: {deleteError}</p>}
          </Modal>
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
