import type { AnalyticsEvent } from './analytics-event.types.js'
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function normalizeEvent(name: unknown, tag: string, params: unknown, timestamp: unknown, fallback: number): AnalyticsEvent | null {
  if (typeof name !== 'string' || !name.trim()) return null
  const validTime = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
  return { eventName: name, eventTag: tag, timestamp: validTime ? timestamp : fallback, eventParams: isRecord(params) ? params : {} }
}
