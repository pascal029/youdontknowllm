import { useState } from 'react'
import { runInSandbox, type SandboxResult } from '../tools/sandbox'
import { exampleArgs, validateTool, type Tool } from '../tools/types'
import './ToolEditor.css'

export const NEW_TOOL_TEMPLATE: Tool = {
  name: 'reverse_text',
  description: 'Reverse the characters of a text.',
  parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  code: 'return args.text.split("").reverse().join("")',
  enabled: true,
}

type Props = {
  /** tool being edited, or the template for a new one */
  initial: Tool
  /** names already taken by other tools */
  takenNames: string[]
  onSave: (tool: Tool) => void
  onCancel: () => void
  /** built-in tools: view + test only */
  readOnly?: boolean
  /** read-only mode: copy this tool into a new editable one */
  onDuplicate?: () => void
  /** injectable for tests/stories */
  run?: (code: string, args: unknown) => Promise<SandboxResult>
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2)

export default function ToolEditor({ initial, takenNames, onSave, onCancel, readOnly, onDuplicate, run = runInSandbox }: Props) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [params, setParams] = useState(pretty(initial.parameters))
  const [code, setCode] = useState(initial.code)
  const [testArgs, setTestArgs] = useState(() => JSON.stringify(exampleArgs(initial)))
  const [errors, setErrors] = useState<string[]>([])
  const [testResult, setTestResult] = useState<SandboxResult | null>(null)

  const parse = (label: string, text: string): { ok: true; value: object } | { ok: false; error: string } => {
    try {
      return { ok: true, value: JSON.parse(text) }
    } catch (e) {
      return { ok: false, error: `${label}: invalid JSON (${(e as Error).message})` }
    }
  }

  const save = () => {
    const p = parse('Parameters', params)
    if (!p.ok) return setErrors([p.error])
    const tool: Tool = { name: name.trim(), description: description.trim(), parameters: p.value, code, enabled: initial.enabled }
    const errs = validateTool(tool, takenNames)
    setErrors(errs)
    if (!errs.length) onSave(tool)
  }

  const test = async () => {
    const a = parse('Test arguments', testArgs)
    if (!a.ok) return setTestResult({ ok: false, error: a.error, logs: [], ms: 0 })
    setTestResult(await run(code, a.value))
  }

  return (
    <form className="tool-editor" onSubmit={(e) => { e.preventDefault(); if (!readOnly) save() }} aria-label="Tool editor">
      {readOnly && (
        <p className="tool-editor__note">
          Built-in tool: read-only. Run it below, or duplicate it to change the code.
        </p>
      )}
      <label className="field">
        <span>Name</span>
        <input className="mono" value={name} readOnly={readOnly} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Description</span>
        <input value={description} readOnly={readOnly} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="field">
        <label>
          <span>Parameters (JSON Schema)</span>
          <textarea className="mono" rows={6} value={params} readOnly={readOnly} onChange={(e) => setParams(e.target.value)} spellCheck={false} />
        </label>
        <small>The model reads this to know which arguments to send.</small>
      </div>
      <div className="field">
        <label>
          <span>Code</span>
          <textarea className="mono" rows={10} value={code} readOnly={readOnly} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
        </label>
        <small>Async function body. Use <code>args</code>, <code>return</code> a value. Runs in a sandboxed worker (3s limit).</small>
      </div>

      <div className="tool-editor__test">
        <label className="field">
          <span>Test arguments</span>
          <input className="mono" value={testArgs} onChange={(e) => setTestArgs(e.target.value)} />
        </label>
        <button type="button" className="btn btn--sm" onClick={test}>Test run</button>
        {testResult && (
          <pre className={`tool-editor__out ${testResult.ok ? '' : 'is-error'}`} role="status">
            {testResult.ok ? `→ ${pretty(testResult.result)}` : `✕ ${testResult.error}`}
            {testResult.logs.length > 0 && `\n\nlogs:\n${testResult.logs.join('\n')}`}
          </pre>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="tool-editor__errors" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="tool-editor__actions">
        {readOnly ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Close</button>
            {onDuplicate && <button type="button" className="btn btn--primary" onClick={onDuplicate}>Duplicate &amp; edit</button>}
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn--primary">Save tool</button>
          </>
        )}
      </div>
    </form>
  )
}
