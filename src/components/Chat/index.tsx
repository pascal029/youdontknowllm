import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Message } from '../../llm/types'
import './index.css'

type Props = {
  messages: Message[]
  /** text being streamed right now, shown as an in-progress assistant bubble */
  streaming?: string
  busy: boolean
  disabled?: boolean
  disabledReason?: string
  onSend: (text: string) => void
  onStop: () => void
  /** start a new session; button hidden when there is nothing to clear */
  onClear?: () => void
}

export default function Chat({ messages, streaming, busy, disabled, disabledReason, onSend, onStop, onClear }: Props) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const visible = messages.filter((m) => m.role !== 'system')

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [visible.length, streaming])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || busy || disabled) return
    onSend(text)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) submit(e)
  }

  return (
    <div className="chat">
      {onClear && visible.length > 0 && (
        <div className="chat__bar">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>New chat</button>
        </div>
      )}
      <div className="chat__log" aria-live="polite">
        {visible.length === 0 && streaming === undefined && (
          <p className="chat__empty">{disabled ? disabledReason : 'Say hi, or ask something that needs a tool, like "what is 23 * 19?"'}</p>
        )}
        {visible.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.role}`}>
            <span className="bubble__role">{m.role}</span>
            <p className="bubble__text">{m.content}</p>
          </div>
        ))}
        {streaming !== undefined && (
          <div className="bubble bubble--assistant" aria-busy="true">
            <span className="bubble__role">assistant</span>
            <p className="bubble__text">{streaming}<span className="caret" aria-hidden="true" /></p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat__composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-input">Message</label>
        <textarea
          id="chat-input"
          rows={2}
          value={draft}
          disabled={disabled}
          placeholder={disabled ? disabledReason : 'Message… (Enter to send, Shift+Enter for new line)'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <button type="button" className="btn btn--danger" onClick={onStop}>Stop</button>
        ) : (
          <button type="submit" className="btn btn--primary" disabled={disabled || !draft.trim()}>Send</button>
        )}
      </form>
    </div>
  )
}
