import type { LogcatEntry } from '../../logcat/logcat.types.js'
import { isRecord, normalizeEvent } from '../../events/event-normalizer.js'
import { extractBalancedObject } from '../payload-utils.js'
export function parseMoEngageEvent(entry: LogcatEntry) {
  try {
    const marker = entry.message.indexOf('Core_EventHandler trackEvent()')
    if (marker < 0) return null
    const json = extractBalancedObject(entry.message, entry.message.indexOf('{', marker))
    if (!json) return null
    const payload: unknown = JSON.parse(json.replace(/^(\{\s*)Event\s*:/, '$1"Event":'))
    if (!isRecord(payload) || !isRecord(payload.Event)) return null
    const event = payload.Event
    if (!isRecord(event.attributes)) return null
    const attrs: unknown = typeof event.attributes.EVENT_ATTRS === 'string' ? JSON.parse(event.attributes.EVENT_ATTRS) : event.attributes.EVENT_ATTRS
    if (!isRecord(attrs)) return null
    return normalizeEvent(event.name, 'moengage', attrs, event.time, entry.timestamp)
  } catch { return null }
}
