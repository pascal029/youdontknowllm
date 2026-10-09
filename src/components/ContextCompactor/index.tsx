import { useEffect, useMemo, useRef, useState } from 'react'
import { dropOldest, estimateTokens, historyTokens, isToolTraffic, stripToolTraffic, type SummaryResult } from '../../agent/compact'
import type { Message } from '../../llm/types'
import './index.css'

type Strategy = 'drop' | 'tools' | 'summary' | 'summary-keep'

const STRATEGIES: { id: Strategy; label: string; hint: string; model?: boolean }[] = [
  { id: 'drop', label: 'Drop oldest messages', hint: 'Sliding window: forget the start of the chat. Free and instant, but early facts are gone.' },
  { id: 'tools', label: 'Remove tool traffic', hint: 'Keep questions and answers, drop tool calls and results. Tool output is often the biggest part.' },
  { id: 'summary', label: 'Summarize everything', hint: 'The model rewrites the whole chat as a short summary. Costs one model call; details can get lost.', model: true },
  { id: 'summary-keep', label: 'Summary + keep last N', hint: 'Summarize the older part, keep the recent messages word for word. What most real apps do.', model: true },
]

type Props = {
  /** what the model currently re-reads every turn */
  history: Message[]
  /** system prompt + tool instructions, always sent, never compacted */
  systemTokens: number
  contextWindow: number
  /** in-browser model: summaries from ≤2B models are unreliable, so we say so */
  local: boolean
  summarize: (history: Message[], keepLast: number, signal: AbortSignal) => Promise<SummaryResult>
  onApply: (next: Message[], label: string) => void
  onCancel: () => void
}

/** Pick a strategy, compare Before | After, apply. Only the model's history changes, never the visible chat. */
export default function ContextCompactor({ history, systemTokens, contextWindow, local, summarize, onApply, onCancel }: Props) {
  const [strategy, setStrategy] = useState<Strategy>('drop')
  const [n, setN] = useState(4)
  const [summary, setSummary] = useState<{ key: string; result: SummaryResult } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const meta = STRATEGIES.find((s) => s.id === strategy)!
  const key = `${strategy}:${strategy === 'summary' ? 0 : n}`
  const after = useMemo(() => {
    if (strategy === 'drop') return dropOldest(history, n)
    if (strategy === 'tools') return stripToolTraffic(history)
    return summary?.key === key ? summary.result.history : null
  }, [strategy, n, history, summary, key])

  async function generate() {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setError('')
    try {
      const result = await summarize(history, strategy === 'summary' ? 0 : n, ac.signal)
      setSummary({ key, result })
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (abortRef.current === ac) setBusy(false)
    }
  }

  const label = { drop: `dropped oldest ${n}`, tools: 'removed tool traffic', summary: 'summary', 'summary-keep': `summary + last ${n}` }[strategy]
  const kept = new Set(after ?? [])
  const original = new Set(history)
  const changed = !!after && (after.length !== history.length || after.some((m, i) => m !== history[i]))

  return (
    <div className="compactor">
      <fieldset className="compactor__strategies">
        <legend className="panel-title">Strategy</legend>
        {STRATEGIES.map((s) => (
          <label key={s.id} className="compactor__strategy">
            <input type="radio" name="compact-strategy" value={s.id} checked={strategy === s.id} onChange={() => setStrategy(s.id)} />
            <span>
              <strong>{s.label}</strong>
              {s.model && <span className="compactor__tag">uses the model</span>}
              <small>{s.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {(strategy === 'drop' || strategy === 'summary-keep') && (
        <div className="field compactor__n">
          <label htmlFor="compact-n">
            <span>{strategy === 'drop' ? 'Messages to drop' : 'Recent messages to keep'}: {n}</span>
          </label>
          <input id="compact-n" type="range" min={2} max={10} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <small>Cuts always land on one of your messages, so the model never starts mid-turn (the actual number can be a bit more).</small>
        </div>
      )}

      {meta.model && local && (
        <p className="compactor__hint" role="note">
          Small in-browser models (≤2B) often write summaries that drop or invent details. For a better summary connect an API model, or use
          <em> Drop oldest</em> / <em>Remove tool traffic</em>, which don't need the model. Check the After column before applying.
        </p>
      )}

      <div className="compactor__compare">
        <Column title="Before" messages={history} systemTokens={systemTokens} contextWindow={contextWindow} mark={(m) => (after && !kept.has(m) ? 'removed' : undefined)} />
        {after ? (
          <Column title="After" messages={after} systemTokens={systemTokens} contextWindow={contextWindow} mark={(m) => (original.has(m) ? undefined : 'new')} />
        ) : (
          <section className="compactor__col compactor__col--empty" aria-label="After">
            <h3 className="compactor__col-title">After</h3>
            <p>Summaries need one call to the model. Generate a preview, check it, then apply.</p>
            <button type="button" className="btn btn--primary btn--sm" onClick={generate} disabled={busy || !history.length}>
              {busy ? 'Summarizing…' : 'Generate preview'}
            </button>
          </section>
        )}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {after && (
        <p className="compactor__delta">
          ≈{(systemTokens + historyTokens(history)).toLocaleString()} → ≈{(systemTokens + historyTokens(after)).toLocaleString()} tokens
          {!changed && ' · nothing to remove with this strategy'}
          {meta.model && summary?.result.usage && ` · the summary call itself used ${(summary.result.usage.promptTokens + summary.result.usage.completionTokens).toLocaleString()} tokens`}
        </p>
      )}

      <div className="compactor__actions">
        {meta.model && after && (
          <button type="button" className="btn btn--ghost" onClick={generate} disabled={busy}>
            {busy ? 'Summarizing…' : 'Regenerate'}
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn--primary" disabled={!after || !changed || busy} onClick={() => after && onApply(after, label)}>
          Apply
        </button>
      </div>
    </div>
  )
}

function Column({ title, messages, systemTokens, contextWindow, mark }: {
  title: string
  messages: Message[]
  systemTokens: number
  contextWindow: number
  mark: (m: Message) => 'removed' | 'new' | undefined
}) {
  const total = systemTokens + historyTokens(messages)
  const pct = contextWindow ? Math.min(100, (total / contextWindow) * 100) : 0
  return (
    <section className="compactor__col" aria-label={title}>
      <h3 className="compactor__col-title">
        {title} <span>≈{total.toLocaleString()} tokens</span>
      </h3>
      <div className="compactor__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <ol className="compactor__list">
        <li className="compactor__msg compactor__msg--system">
          <span className="compactor__role">system + tools</span>
          <span className="compactor__tokens">≈{systemTokens.toLocaleString()}</span>
          <span className="compactor__text">Always sent, never compacted</span>
        </li>
        {messages.map((m, i) => {
          const state = mark(m)
          return (
            <li key={i} className={`compactor__msg${state ? ` compactor__msg--${state}` : ''}`}>
              <span className="compactor__role">
                {kind(m)}
                {state === 'removed' && <span className="sr-only"> (removed)</span>}
                {state === 'new' && <span className="sr-only"> (new)</span>}
              </span>
              <span className="compactor__tokens">≈{estimateTokens(m.content).toLocaleString()}</span>
              <span className="compactor__text">{m.content}</span>
            </li>
          )
        })}
        {!messages.length && <li className="compactor__msg compactor__msg--none">No messages</li>}
      </ol>
    </section>
  )
}

const kind = (m: Message) =>
  !isToolTraffic(m) ? m.role : m.role === 'assistant' ? 'tool call' : m.content.startsWith('<tool_response>') ? 'tool result' : 'retry'
