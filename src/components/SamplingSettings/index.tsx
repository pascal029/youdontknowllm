import type { Sampling } from '../../llm/types'
import './index.css'

type Param = { key: keyof Sampling; label: string; hint: string; min: number; max?: number; step: number; /** slider position while unset */ rest?: number; warn?: string }

const PARAMS: Param[] = [
  { key: 'temperature', label: 'Temperature', hint: 'Higher = more random. 0 = always the likeliest token.', min: 0, max: 2, step: 0.05, rest: 1 },
  { key: 'top_p', label: 'Top-p', hint: 'Sample only from the smallest set of tokens that adds up to this probability.', min: 0, max: 1, step: 0.01, rest: 1 },
  { key: 'top_k', label: 'Top-k', hint: 'Sample only from the k likeliest tokens.', min: 1, max: 100, step: 1, rest: 40, warn: 'Not in the OpenAI spec: Groq and OpenAI reject it, local models ignore it.' },
  { key: 'max_tokens', label: 'Max tokens', hint: 'Stop after this many tokens. Thinking models spend some of it on thinking.', min: 1, step: 1 },
  { key: 'seed', label: 'Seed', hint: 'Same seed + same settings = (usually) the same answer.', min: 0, step: 1 },
]

type Props = { value: Sampling; onChange: (v: Sampling) => void }

/** Sampling knobs. An empty field is not sent, so the model's own default applies. */
export default function SamplingSettings({ value, onChange }: Props) {
  // a half-typed number like "0." reads as "" (badInput) in the number field; ignored there so it doesn't unset the key
  const set = (key: keyof Sampling, raw: string) => {
    const next = { ...value }
    const n = Number(raw)
    if (raw === '' || !Number.isFinite(n)) delete next[key]
    else next[key] = n
    onChange(next)
  }
  const count = Object.keys(value).length

  return (
    <details className="sampling">
      <summary>
        <span className="panel-title">Sampling</span>
        <span className="sampling__meta">{count ? `${count} set` : 'model defaults'}</span>
      </summary>
      <div className="sampling__body">
        {PARAMS.map((p) => {
          const v = value[p.key]
          const id = `sampling-${p.key}`
          return (
            <div key={p.key} className="field sampling__param">
              <label htmlFor={id}>
                <span>{p.label}</span>
              </label>
              <div className="sampling__inputs">
                {p.max !== undefined && (
                  <input
                    type="range"
                    aria-label={`${p.label} slider`}
                    className={v === undefined ? 'is-unset' : undefined}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={v ?? p.rest}
                    onChange={(e) => set(p.key, e.target.value)}
                  />
                )}
                <input id={id} type="number" inputMode="decimal" placeholder="default" min={p.min} max={p.max} step={p.step} value={v ?? ''} onChange={(e) => !e.target.validity.badInput && set(p.key, e.target.value)} />
              </div>
              <small>{p.hint}</small>
              {p.warn && v !== undefined && <small className="sampling__warn">{p.warn}</small>}
            </div>
          )
        })}
        <div className="sampling__foot">
          <a href="/learn/sampling/">How sampling works</a>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({})} disabled={!count}>
            Reset to defaults
          </button>
        </div>
      </div>
    </details>
  )
}
