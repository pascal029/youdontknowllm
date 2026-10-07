import type { Usage } from '../llm/types'
import './SpeedStats.css'

export type LiveSpeed = { tokens: number; tps?: number }

type Props = {
  usage: Usage
  /** wall time of the model call */
  ms: number
  /** while generating: tokens so far + live decode rate */
  live?: LiveSpeed
}

/** tokens/sec from a token count and the time since the first token. Undefined until 250ms of data. */
export const liveRate = (tokens: number, firstAt: number, now: number) => (now - firstAt >= 250 ? tokens / ((now - firstAt) / 1000) : undefined)

const fmt = (n?: number) => (n === undefined || !Number.isFinite(n) ? '—' : n >= 100 ? Math.round(n).toString() : n.toFixed(1))

export default function SpeedStats({ usage, ms, live }: Props) {
  return (
    <dl className={`speed ${live ? 'is-live' : ''}`} aria-label="Inference speed">
      <div className="speed__item">
        <dt>Prefill</dt>
        <dd><span className="speed__num">{fmt(usage.prefillTps)}</span> tok/s</dd>
        <dd className="speed__hint">reading the prompt</dd>
      </div>
      <div className="speed__item">
        <dt>Decode {live && <span className="speed__live">live</span>}</dt>
        <dd><span className="speed__num">{fmt(live ? live.tps : usage.decodeTps)}</span> tok/s</dd>
        <dd className="speed__hint">writing the reply</dd>
      </div>
      <div className="speed__item">
        <dt>{live ? 'Generating' : 'Last call'}</dt>
        <dd><span className="speed__num">{live ? live.tokens : (ms / 1000).toFixed(2)}</span> {live ? 'tok' : 's'}</dd>
        <dd className="speed__hint">{live ? 'so far' : `${usage.completionTokens} tokens out`}</dd>
      </div>
    </dl>
  )
}
