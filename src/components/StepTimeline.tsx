import type { Step } from '../agent/loop'
import Icon, { type IconName } from './Icon'
import './StepTimeline.css'

type Props = {
  steps: Step[]
  /** raw text the model is generating right now */
  streaming?: string
}

const json = (v: unknown) => JSON.stringify(v, null, 2)

function describe(s: Step): { icon: IconName; title: string; meta?: string; body?: string; tone?: 'ok' | 'error'; hint?: string } {
  switch (s.type) {
    case 'user':
      return { icon: 'user', title: 'You asked', body: s.text }
    case 'model':
      return {
        icon: 'cpu',
        title: `Model call #${s.iteration}`,
        meta: `${s.ms} ms · ${s.usage.promptTokens} in / ${s.usage.completionTokens} out`,
        body: s.text || '(empty reply)',
      }
    case 'tool-call':
      return { icon: 'wrench', title: `Model chose tool: ${s.name}`, body: json(s.arguments) }
    case 'tool-result':
      return s.result.ok
        ? { icon: 'terminal', title: `${s.name} returned`, meta: `${s.result.ms} ms in sandbox`, body: json(s.result.result) + (s.result.logs.length ? `\n\nlogs:\n${s.result.logs.join('\n')}` : ''), tone: 'ok' }
        : { icon: 'terminal', title: `${s.name} failed`, meta: `${s.result.ms} ms in sandbox`, body: s.result.error, tone: 'error', hint: 'The error was sent back to the model so it can try again or explain.' }
    case 'parse-error':
      return { icon: 'alert', title: 'Could not read tool call', meta: s.error, body: s.raw, tone: 'error', hint: 'Small models often break the format. We told the model what went wrong and let it retry.' }
    case 'answer':
      return { icon: 'check', title: 'Final answer', body: s.text, tone: 'ok' }
    case 'error':
      return { icon: 'alert', title: 'Stopped', body: s.error, tone: 'error', hint: 'The loop has a limit so a confused model cannot call tools forever.' }
  }
}

export default function StepTimeline({ steps, streaming }: Props) {
  if (!steps.length && streaming === undefined) {
    return <p className="timeline__empty">Send a message to see each step: your prompt → model → tool → result → answer.</p>
  }
  return (
    <ol className="timeline" aria-label="Agent steps">
      {steps.map((s, i) => {
        const d = describe(s)
        return (
          <li key={i} className={`step step--${s.type} ${d.tone ? `is-${d.tone}` : ''}`}>
            <span className="step__icon"><Icon name={d.icon} /></span>
            <div className="step__card">
              <div className="step__head">
                <span className="step__title">{d.title}</span>
                {d.meta && <span className="step__meta">{d.meta}</span>}
              </div>
              {d.body && <pre className="step__body">{d.body}</pre>}
              {d.hint && <p className="step__hint">{d.hint}</p>}
              <details className="step__raw">
                <summary>raw event</summary>
                <pre>{json(s)}</pre>
              </details>
            </div>
          </li>
        )
      })}
      {streaming !== undefined && (
        <li className="step step--live" aria-busy="true">
          <span className="step__icon"><Icon name="cpu" /></span>
          <div className="step__card">
            <div className="step__head"><span className="step__title">Model is generating…</span></div>
            <pre className="step__body">{streaming}<span className="caret" aria-hidden="true" /></pre>
          </div>
        </li>
      )}
    </ol>
  )
}
