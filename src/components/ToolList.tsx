import type { Tool } from '../tools/types'
import './ToolList.css'

type Props = {
  tools: Tool[]
  onToggle: (name: string, enabled: boolean) => void
  /** custom tools only */
  onEdit?: (tool: Tool) => void
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
          {!t.builtin && (onEdit || onDelete) && (
            <div className="tool__actions">
              {onEdit && <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(t)} aria-label={`Edit ${t.name}`}>Edit</button>}
              {onDelete && <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => onDelete(t)} aria-label={`Delete ${t.name}`}>Delete</button>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
