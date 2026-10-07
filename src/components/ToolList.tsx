import type { Tool } from '../tools/types'
import './ToolList.css'

type Props = {
  tools: Tool[]
  onToggle: (name: string, enabled: boolean) => void
  /** open the code: "View code" for built-ins, "Edit" for custom tools */
  onEdit?: (tool: Tool) => void
  /** custom tools only */
  onDelete?: (tool: Tool) => void
}

export default function ToolList({ tools, onToggle, onEdit, onDelete }: Props) {
  const on = tools.filter((t) => t.enabled).length
  return (
    <ul className="tools" aria-label={`Tools, ${on} of ${tools.length} enabled`}>
      {tools.map((t) => (
        <li key={t.name} className="tool">
          <label className="tool__toggle">
            <input type="checkbox" checked={t.enabled} onChange={(e) => onToggle(t.name, e.target.checked)} aria-describedby={`tool-desc-${t.name}`} />
            <span className="tool__name">{t.name}</span>
            {!t.builtin && <span className="badge">custom</span>}
          </label>
          <p id={`tool-desc-${t.name}`} className="tool__desc">{t.description}</p>
          {(onEdit || (onDelete && !t.builtin)) && (
            <div className="tool__actions">
              {onEdit &&
                (t.builtin ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(t)} aria-label={`View ${t.name} code`}>View code</button>
                ) : (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(t)} aria-label={`Edit ${t.name}`}>Edit</button>
                ))}
              {onDelete && !t.builtin && (
                <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => onDelete(t)} aria-label={`Delete ${t.name}`}>Delete</button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
