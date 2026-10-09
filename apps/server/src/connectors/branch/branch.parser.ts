import type { LogcatEntry } from '../../logcat/logcat.types.js'
import { isRecord, normalizeEvent } from '../../events/event-normalizer.js'
import { extractBalancedObject } from '../payload-utils.js'
export function parseBranchEvent(entry: LogcatEntry) {
  try {
    const marker = entry.message.indexOf('setPost')
    if (marker < 0) return null
    const json = extractBalancedObject(entry.message, entry.message.indexOf('{', marker + 7))
    if (!json) return null
    const payload: unknown = JSON.parse(json)
    if (!isRecord(payload)) return null
    const { name, ...params } = payload
    return normalizeEvent(name, 'branch', params, undefined, entry.timestamp)
  } catch { return null }
}
