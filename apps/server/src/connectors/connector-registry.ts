import type { LogcatEntry } from '../logcat/logcat.types.js'
import { DEFAULT_CONNECTOR_SETTINGS, type ConnectorSettings } from '../settings/connector-settings.js'
import type { AnalyticsConnector, ConnectorContext } from './connector.types.js'
import { analyticsEventConnector } from './analytics-event/analytics-event.connector.js'
import { googleAnalyticsConnector } from './google-analytics/google-analytics.connector.js'
import { branchConnector } from './branch/branch.connector.js'
import { moEngageConnector } from './moengage/moengage.connector.js'
export class ConnectorRegistry {
  private readonly byTag = new Map<string, AnalyticsConnector[]>()
  constructor(private readonly connectors: AnalyticsConnector[] = [analyticsEventConnector, googleAnalyticsConnector, branchConnector, moEngageConnector]) {
    for (const connector of connectors) for (const filter of connector.logcatFilters) {
      const tag = filter.split(':')[0]
      this.byTag.set(tag, [...(this.byTag.get(tag) ?? []), connector])
    }
  }
  getEnabled(settings: ConnectorSettings) { return this.connectors.filter(c => c.id === 'analytics_event' || settings[c.id]) }
  getFilters(settings: ConnectorSettings) { return [...new Set(this.getEnabled(settings).flatMap(c => c.logcatFilters))] }
  async setup(settings: ConnectorSettings, context: ConnectorContext) {
    for (const connector of this.getEnabled(settings)) await connector.setup?.(context)
  }
  parse(entry: LogcatEntry, settings = DEFAULT_CONNECTOR_SETTINGS) {
    for (const connector of this.byTag.get(entry.tag) ?? []) {
      if (connector.id !== 'analytics_event' && !settings[connector.id]) continue
      try {
        if (!connector.matches(entry)) continue
        const event = connector.parse(entry)
        if (event) return event
      } catch { /* A faulty connector must not interrupt ingestion. */ }
    }
    return null
  }
}
