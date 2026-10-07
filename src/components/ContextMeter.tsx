import './ContextMeter.css'

type Props = {
  /** tokens the conversation occupies (last prompt + reply) */
  used: number
  /** model context window */
  total: number
}

export const contextLevel = (pct: number) => (pct >= 85 ? 'danger' : pct >= 60 ? 'warn' : 'ok')

export default function ContextMeter({ used, total }: Props) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const left = Math.max(0, total - used)
  const level = contextLevel(pct)
  return (
    <div className={`ctx ctx--${level}`}>
      <div className="ctx__row">
        <span className="ctx__label">Context window</span>
        <span className="ctx__num">{left.toLocaleString()} left</span>
      </div>
      <meter min={0} max={total || 1} value={used} low={total * 0.6} high={total * 0.85} optimum={0} aria-label="Context window used">
        {Math.round(pct)}%
      </meter>
      <div className="ctx__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <p className="ctx__detail">
        {used.toLocaleString()} / {total.toLocaleString()} tokens ({Math.round(pct)}%)
        {level === 'danger' && ' · almost full: the model will start forgetting or fail. Clear the chat.'}
      </p>
    </div>
  )
}
