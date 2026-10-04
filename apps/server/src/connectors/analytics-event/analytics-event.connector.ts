import type { AnalyticsConnector } from '../connector.types.js'
import { isRecord, normalizeEvent } from '../../events/event-normalizer.js'
export const analyticsEventConnector: AnalyticsConnector = {
  id: 'analytics_event', logcatFilters: ['AnalyticsEvent:V'],
  matches: entry => entry.tag === 'AnalyticsEvent',
  parse(entry) {
    try {
      const payload: unknown = JSON.parse(entry.message)
      if (!isRecord(payload)) return null
      const tag = typeof payload.eventTag === 'string' ? payload.eventTag : 'analytics_event'
      return normalizeEvent(payload.eventName, tag, payload.eventParams, payload.timestamp, entry.timestamp)
    } catch { return null }
  },
}
