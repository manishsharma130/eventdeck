import type { LogcatEntry } from '../../logcat/logcat.types.js'
import { normalizeEvent } from '../../events/event-normalizer.js'

function splitFields(input: string): string[] {
  const fields: string[] = []
  const stack: string[] = []
  let quote = false, escape = false, start = 0
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quote) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') quote = false
    } else if (c === '"') quote = true
    else if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') {
      if (stack.pop() !== (c === '}' ? '{' : '[')) throw new Error('Unbalanced Bundle')
    } else if (c === ',' && !stack.length) { fields.push(input.slice(start, i)); start = i + 1 }
  }
  if (quote || stack.length) throw new Error('Incomplete Bundle')
  fields.push(input.slice(start))
  return fields
}
export function parseBundleValue(value: string): unknown {
  const v = value.trim()
  if (v.startsWith('Bundle[') && v.endsWith(']')) return parseBundle(v.slice(7, -1))
  if (v.startsWith('{') && v.endsWith('}')) return parseBundle(v)
  if (v.startsWith('[') && v.endsWith(']')) return v === '[]' ? [] : splitFields(v.slice(1, -1)).map(parseBundleValue)
  if (v.startsWith('"')) return JSON.parse(v)
  if (v === 'null') return null
  if (v === 'true' || v === 'false') return v === 'true'
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)) {
    const n = Number(v)
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n
  }
  return v
}
export function parseBundle(input: string): Record<string, unknown> {
  const text = input.trim()
  if (!text.startsWith('{') || !text.endsWith('}')) throw new Error('Invalid Bundle')
  if (!text.slice(1, -1).trim()) return {}
  return Object.fromEntries(splitFields(text.slice(1, -1)).map(field => {
    const equals = field.indexOf('=')
    if (equals < 1 || !field.slice(0, equals).trim()) throw new Error('Invalid Bundle field')
    return [field.slice(0, equals).trim(), parseBundleValue(field.slice(equals + 1))]
  }))
}
export function parseGoogleAnalyticsEvent(entry: LogcatEntry) {
  try {
    const match = entry.message.match(/Logging event:.*?\bname=([^,]+),\s*params=Bundle\[(.*)\]\s*$/)
    return match ? normalizeEvent(match[1].trim(), 'google_analytics', parseBundle(match[2]), undefined, entry.timestamp) : null
  } catch { return null }
}
