import { useEffect, useId, useRef, type ReactNode } from 'react'
import './index.css'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** action buttons, rendered right-aligned at the bottom */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Reusable modal on the native <dialog>: the browser gives us the focus trap, Esc to close,
 * inert background and focus restore. Children only render while open, so forms start fresh.
 */
export default function Modal({ open, title, onClose, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault() // Esc: let React state decide
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose() // click on the backdrop
      }}
    >
      {open && (
        <div className="modal__panel">
          <header className="modal__head">
            <h2 id={titleId} className="modal__title">{title}</h2>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
