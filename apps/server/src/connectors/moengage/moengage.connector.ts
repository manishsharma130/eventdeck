import type { AnalyticsConnector } from '../connector.types.js'
import { parseMoEngageEvent } from './moengage.parser.js'
export const moEngageConnector: AnalyticsConnector = {
  id: 'moengage', logcatFilters: ['MoEngage:D'],
  matches: e => e.tag === 'MoEngage' && e.level === 'D' && e.message.includes('Core_EventHandler trackEvent()'),
  parse: parseMoEngageEvent,
}
