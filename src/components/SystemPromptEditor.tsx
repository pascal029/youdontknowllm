import './SystemPromptEditor.css'

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant. Answer briefly and clearly. If a tool can give a more accurate answer, use it.'

type Props = { value: string; onChange: (v: string) => void }

export default function SystemPromptEditor({ value, onChange }: Props) {
  return (
    <section className="sysprompt" aria-labelledby="sysprompt-title">
      <div className="sysprompt__head">
        <h2 id="sysprompt-title" className="panel-title">System prompt</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(DEFAULT_SYSTEM_PROMPT)} disabled={value === DEFAULT_SYSTEM_PROMPT}>
          Reset
        </button>
      </div>
      <div className="field">
        <label className="sr-only" htmlFor="sysprompt-input">System prompt</label>
        <textarea id="sysprompt-input" className="mono" rows={6} value={value} onChange={(e) => onChange(e.target.value)} />
        <small>Hidden instructions sent before every chat. Try changing the persona and watch the answers change.</small>
      </div>
    </section>
  )
}
