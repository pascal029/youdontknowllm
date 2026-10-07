import type { Usage } from '../llm/types'
import './SpeedStats.css'

type Props = {
  usage: Usage
  /** wall time of the model call */
  ms: number
}

const fmt = (n?: number) => (n === undefined || !Number.isFinite(n) ? '—' : n >= 100 ? Math.round(n).toString() : n.toFixed(1))

export default function SpeedStats({ usage, ms }: Props) {
  return (
    <dl className="speed" aria-label="Inference speed">
      <div className="speed__item">
        <dt>Prefill</dt>
        <dd><span className="speed__num">{fmt(usage.prefillTps)}</span> tok/s</dd>
        <dd className="speed__hint">reading the prompt</dd>
      </div>
      <div className="speed__item">
        <dt>Decode</dt>
        <dd><span className="speed__num">{fmt(usage.decodeTps)}</span> tok/s</dd>
        <dd className="speed__hint">writing the reply</dd>
      </div>
      <div className="speed__item">
        <dt>Last call</dt>
        <dd><span className="speed__num">{(ms / 1000).toFixed(2)}</span> s</dd>
        <dd className="speed__hint">{usage.completionTokens} tokens out</dd>
      </div>
    </dl>
  )
}
