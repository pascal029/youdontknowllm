import { prebuiltAppConfig } from '@mlc-ai/web-llm'
import { expect, test } from 'vitest'
import { LOCAL_MODELS } from './models'

test('ships exactly 5 models, all ≤2B params', () => {
  expect(LOCAL_MODELS).toHaveLength(5)
  for (const m of LOCAL_MODELS) expect(m.paramsB).toBeLessThanOrEqual(2)
})

test('every model id exists in the WebLLM prebuilt catalog', () => {
  const ids = new Set(prebuiltAppConfig.model_list.map((m) => m.model_id))
  for (const m of LOCAL_MODELS) expect(ids, m.id).toContain(m.id)
})
