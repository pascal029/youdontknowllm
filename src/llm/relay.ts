/**
 * Some hosted APIs don't allow browser requests (no CORS headers), e.g. ollama.com: the preflight
 * gets 405 and responses carry no Access-Control-Allow-Origin. For those hosts only, requests go to
 * this site's own path, which Netlify (netlify.toml) and Vite (vite.config.ts) forward server-side.
 * Everything else, including a local Ollama, is called directly.
 */
export const RELAYED_ORIGINS: Record<string, string> = {
  'https://ollama.com': '/relay/ollama',
}

/** Where to actually send requests for `baseURL`, plus whether it goes through the relay. */
export function resolveBaseURL(
  baseURL: string,
  siteOrigin = (globalThis as { location?: { origin: string } }).location?.origin ?? '',
): { url: string; relayed: boolean } {
  const trimmed = baseURL.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { url: trimmed, relayed: false }
  }
  const prefix = RELAYED_ORIGINS[parsed.origin]
  if (!prefix) return { url: trimmed, relayed: false }
  return { url: `${siteOrigin}${prefix}${parsed.pathname.replace(/\/+$/, '')}`, relayed: true }
}
