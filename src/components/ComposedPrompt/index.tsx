import './index.css'

type Props = { text: string }

/** Read-only view of exactly what goes in the system message. */
export default function ComposedPrompt({ text }: Props) {
  const tokens = Math.ceil(text.length / 4)
  return (
    <details className="composed">
      <summary>
        Full prompt sent to the model <span className="composed__meta">~{tokens} tokens</span>
      </summary>
      <pre className="composed__body">{text || '(empty)'}</pre>
    </details>
  )
}
