// Which local models are already downloaded into the browser, and deleting them.
// WebLLM is imported lazily (~6 MB) so the app shell stays light; this only runs in "In browser" mode.

/** Model ids (from `ids`) whose weights are in the browser cache. Errors count as "not cached". */
export async function cachedModelIds(ids: string[]): Promise<Set<string>> {
  const { hasModelInCache } = await import('@mlc-ai/web-llm')
  const found = await Promise.all(ids.map((id) => hasModelInCache(id).catch(() => false)))
  return new Set(ids.filter((_, i) => found[i]))
}

/** Remove a model's weights, config and compiled code from the browser cache. */
export async function deleteCachedModel(id: string): Promise<void> {
  const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm')
  await deleteModelAllInfoInCache(id)
}
