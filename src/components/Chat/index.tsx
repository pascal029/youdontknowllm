import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { splitThink } from '../../agent/parseToolCall'
import type { Message } from '../../llm/types'
import './index.css'

/** a chat bubble (assistant answers may carry the model's reasoning), or a notice line such as "context compacted" */
export type ChatMessage = (Message & { thinking?: string }) | { role: 'notice'; content: string }

type Props = {
  messages: ChatMessage[]
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
  const live = streaming === undefined ? undefined : splitThink(streaming)
  // still inside an unclosed <think> → the model is thinking, keep it open and put the caret there
  const thinkingNow = !!streaming && /<think>(?![\s\S]*<\/think>)/.test(streaming)

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
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e) // IME Enter confirms text, doesn't send
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
        {visible.map((m, i) =>
          m.role === 'notice' ? (
            <p key={i} className="chat__notice" role="note">{m.content}</p>
          ) : (
            <div key={i} className={`bubble bubble--${m.role}`}>
              <span className="bubble__role">{m.role}</span>
              {m.thinking && <Thinking text={m.thinking} />}
              <p className="bubble__text">{m.content}</p>
            </div>
          ),
        )}
        {live && (
          <div className="bubble bubble--assistant" aria-busy="true">
            <span className="bubble__role">assistant</span>
            {live.thinking && <Thinking text={live.thinking} open={thinkingNow} live={thinkingNow} />}
            {!thinkingNow && <p className="bubble__text">{live.text}<span className="caret" aria-hidden="true" /></p>}
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

function Thinking({ text, open, live }: { text: string; open?: boolean; live?: boolean }) {
  return (
    <details className="thinking" open={open}>
      <summary>{live ? 'Thinking…' : 'Thought process'}</summary>
      <p className="thinking__text">{text}{live && <span className="caret" aria-hidden="true" />}</p>
    </details>
  )
}
