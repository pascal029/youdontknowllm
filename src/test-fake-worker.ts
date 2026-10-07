import { vi } from 'vitest'
import { WORKER_SRC } from './tools/sandbox'

/** jsdom has no Worker: run the real sandbox worker source against a fake `self`, async like a real worker. */
export class FakeWorker {
  static terminated: FakeWorker[] = []
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
    FakeWorker.terminated.push(this)
  }
}

export function installFakeWorker() {
  FakeWorker.terminated.length = 0
  vi.stubGlobal('Worker', FakeWorker)
  URL.createObjectURL = () => 'blob:fake'
  URL.revokeObjectURL = () => {}
}
