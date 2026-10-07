export type SandboxResult =
  | { ok: true; result: unknown; logs: string[]; ms: number }
  | { ok: false; error: string; logs: string[]; ms: number }

/**
 * Source of the throwaway worker. Kept as a string so the bundler can't rewrite it.
 * Worker = no DOM, no access to the page's localStorage (API key) or React state.
 * We also hide storage APIs so tool code can't touch the cached model files.
 */
export const WORKER_SRC = `
for (const k of ['indexedDB', 'caches', 'importScripts']) {
  try { Object.defineProperty(self, k, { value: undefined }) } catch {}
}
const logs = []
const fmt = (a) => a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')
// Tool code gets its own console that records output for the step timeline.
const toolConsole = {
  log: (...a) => logs.push(fmt(a)),
  info: (...a) => logs.push(fmt(a)),
  warn: (...a) => logs.push('warn: ' + fmt(a)),
  error: (...a) => logs.push('error: ' + fmt(a)),
}
self.onmessage = async (e) => {
  const { code, args } = e.data
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const value = await new AsyncFunction('args', 'console', code)(args, toolConsole)
    self.postMessage({ ok: true, result: value === undefined ? null : JSON.parse(JSON.stringify(value)), logs })
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err), logs })
  }
}
`

/** Run tool code in a fresh worker. Always terminates it: on result, on error, or on timeout. */
export function runInSandbox(code: string, args: unknown, timeoutMs = 3000): Promise<SandboxResult> {
  const start = performance.now()
  const ms = () => Math.round(performance.now() - start)
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }))
  const worker = new Worker(url)

  return new Promise<SandboxResult>((resolve) => {
    const finish = (r: SandboxResult) => {
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      resolve(r)
    }
    const timer = setTimeout(() => finish({ ok: false, error: `Timed out after ${timeoutMs}ms (worker killed).`, logs: [], ms: ms() }), timeoutMs)
    worker.onmessage = (e: MessageEvent) => finish({ ...e.data, ms: ms() })
    worker.onerror = (e: ErrorEvent) => {
      e.preventDefault()
      finish({ ok: false, error: e.message || 'Worker error', logs: [], ms: ms() })
    }
    worker.postMessage({ code, args })
  })
}
