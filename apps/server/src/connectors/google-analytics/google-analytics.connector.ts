import type { AnalyticsConnector } from '../connector.types.js'
import { parseGoogleAnalyticsEvent } from './google-analytics.parser.js'
import { setupGoogleAnalytics } from './google-analytics.setup.js'
export const googleAnalyticsConnector: AnalyticsConnector = {
  id: 'google_analytics', logcatFilters: ['FA:V', 'FA-SVC:V'], setup: setupGoogleAnalytics,
  matches: e => ['FA', 'FA-SVC'].includes(e.tag) && e.level === 'V' && e.message.includes('Logging event:'),
  parse: parseGoogleAnalyticsEvent,
}
