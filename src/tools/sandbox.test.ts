import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { runInSandbox, WORKER_SRC } from './sandbox'

// jsdom has no Worker: run the real worker source against a fake `self`, async like a real worker.
const terminated: FakeWorker[] = []
class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror = null
  private self: { onmessage?: (e: { data: unknown }) => void; postMessage: (d: unknown) => void } = {
    postMessage: (d) => setTimeout(() => this.onmessage?.({ data: d })),
  }
  constructor() {
    new Function('self', WORKER_SRC)(this.self)
  }
  postMessage(data: unknown) {
    setTimeout(() => this.self.onmessage?.({ data }))
  }
  terminate() {
    terminated.push(this)
  }
}

beforeEach(() => {
  terminated.length = 0
  vi.stubGlobal('Worker', FakeWorker)
  URL.createObjectURL = () => 'blob:fake'
  URL.revokeObjectURL = () => {}
})
afterEach(() => vi.unstubAllGlobals())

test('returns the value, captures console.log, terminates the worker', async () => {
  const r = await runInSandbox('console.log("adding", args); return args.a + args.b', { a: 2, b: 3 })
  expect(r).toMatchObject({ ok: true, result: 5, logs: ['adding {"a":2,"b":3}'] })
  expect(terminated).toHaveLength(1)
})

test('supports await inside tool code', async () => {
  const r = await runInSandbox('await new Promise(r => setTimeout(r, 5)); return "done"', {})
  expect(r).toMatchObject({ ok: true, result: 'done' })
})

test('undefined becomes null; non-JSON values are dropped', async () => {
  expect(await runInSandbox('', {})).toMatchObject({ ok: true, result: null })
  expect(await runInSandbox('return { f: () => 1, n: 1 }', {})).toMatchObject({ ok: true, result: { n: 1 } })
})

test('thrown errors come back as ok:false', async () => {
  const r = await runInSandbox('throw new Error("boom")', {})
  expect(r).toMatchObject({ ok: false, error: 'boom' })
  expect(terminated).toHaveLength(1)
})

test('syntax errors come back as ok:false', async () => {
  const r = await runInSandbox('return (', {})
  expect(r.ok).toBe(false)
})

test('times out and kills code that never finishes', async () => {
  const r = await runInSandbox('await new Promise(() => {})', {}, 50)
  expect(r).toMatchObject({ ok: false, error: 'Timed out after 50ms (worker killed).' })
  expect(terminated).toHaveLength(1)
})
