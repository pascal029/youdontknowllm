import type { Tool } from './types'

// Built-in tools are plain JS strings run in the same sandbox as user tools, so learners can read
// (and copy) exactly what executes.

const calculator: Tool = {
  name: 'calculator',
  example: { expression: '23 * 19' },
  description: 'Evaluate a math expression. Supports + - * / % ^ ( ) and Math functions like sqrt, sin, log, PI.',
  parameters: {
    type: 'object',
    properties: { expression: { type: 'string', description: 'e.g. "23 * 19" or "sqrt(2) ^ 2"' } },
    required: ['expression'],
  },
  code: `const expr = String(args.expression ?? '')
const names = expr.match(/[a-zA-Z_]+/g) ?? []
const bad = names.filter((n) => !Object.hasOwn(Math, n) && n !== 'e' && n !== 'E')
if (bad.length) throw new Error('Unknown name(s): ' + bad.join(', '))
if (/[^0-9a-zA-Z_+\\-*/%^().,\\s]/.test(expr)) throw new Error('Only numbers, operators and Math functions are allowed')
const js = expr.replace(/\\^/g, '**').replace(/[a-zA-Z_]+/g, (n) => (Object.hasOwn(Math, n) ? 'Math.' + n : n))
const value = Function('"use strict"; return (' + js + ')')()
if (typeof value !== 'number' || Number.isNaN(value)) throw new Error('Result is not a number')
return value`,
  enabled: true,
  builtin: true,
}

const getCurrentTime: Tool = {
  name: 'get_current_time',
  example: { timezone: 'Asia/Jakarta' },
  description: 'Get the current date and time, optionally in a given IANA timezone like "Asia/Jakarta".',
  parameters: { type: 'object', properties: { timezone: { type: 'string', description: 'IANA timezone, optional' } } },
  code: `const timeZone = args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
const now = new Date()
return {
  timezone: timeZone,
  local: now.toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'long' }),
  iso: now.toISOString(),
}`,
  enabled: true,
  builtin: true,
}

const randomNumber: Tool = {
  name: 'random_number',
  example: { min: 1, max: 6 },
  description: 'Generate a random integer between min and max (inclusive).',
  parameters: {
    type: 'object',
    properties: { min: { type: 'integer' }, max: { type: 'integer' } },
    required: ['min', 'max'],
  },
  code: `const min = Math.ceil(Number(args.min)), max = Math.floor(Number(args.max))
if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error('Need numbers with min <= max')
return min + Math.floor(Math.random() * (max - min + 1))`,
  enabled: true,
  builtin: true,
}

const runJavascript: Tool = {
  name: 'run_javascript',
  example: { code: 'return [1, 2, 3].map((x) => x * 2)' },
  description: 'Run a JavaScript snippet and return its result. Use `return` to give back a value; console.log output is captured.',
  parameters: {
    type: 'object',
    properties: { code: { type: 'string', description: 'JavaScript function body, e.g. "return [1,2,3].map(x => x * 2)"' } },
    required: ['code'],
  },
  code: `const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
return await new AsyncFunction('console', String(args.code ?? ''))(console)`,
  enabled: true,
  builtin: true,
}

const wikipediaSearch: Tool = {
  name: 'wikipedia_search',
  example: { query: 'WebGPU' },
  description: 'Search English Wikipedia and return the top 3 article titles with short snippets.',
  parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  code: `const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=' + encodeURIComponent(args.query ?? '')
const res = await fetch(url)
if (!res.ok) throw new Error('Wikipedia HTTP ' + res.status)
const data = await res.json()
return data.query.search.map((r) => ({
  title: r.title,
  snippet: r.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
  url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')),
}))`,
  enabled: true,
  builtin: true,
}

export const BUILTIN_TOOLS: Tool[] = [calculator, getCurrentTime, randomNumber, runJavascript, wikipediaSearch]
