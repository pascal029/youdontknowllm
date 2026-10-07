import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { RELAYED_ORIGINS, resolveBaseURL } from './relay'

const site = 'https://youdontknowllm.netlify.app'

test('ollama.com goes through the site relay, keeping the path', () => {
  expect(resolveBaseURL('https://ollama.com/v1', site)).toEqual({ url: `${site}/relay/ollama/v1`, relayed: true })
  expect(resolveBaseURL(' https://ollama.com/v1/ ', site)).toEqual({ url: `${site}/relay/ollama/v1`, relayed: true })
})

test('everything else is called directly', () => {
  for (const u of ['https://api.openai.com/v1', 'http://192.168.68.116:11434/v1', 'http://localhost:11434/v1', 'https://ollama.com.evil.example/v1']) {
    expect(resolveBaseURL(u, site)).toEqual({ url: u, relayed: false })
  }
})

test('invalid URLs pass through untouched (fetch reports the error)', () => {
  expect(resolveBaseURL('not a url', site)).toEqual({ url: 'not a url', relayed: false })
})

test('every relayed origin has matching Netlify and Vite forwarding rules', () => {
  const root = join(import.meta.dirname, '../..')
  const netlify = readFileSync(join(root, 'netlify.toml'), 'utf8')
  const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8')
  for (const [origin, prefix] of Object.entries(RELAYED_ORIGINS)) {
    expect(netlify).toContain(`from = "${prefix}/*"`)
    expect(netlify).toContain(`to = "${origin}/:splat"`)
    expect(vite).toContain('RELAYED_ORIGINS')
  }
})
