import type { LogcatEntry } from '../logcat/logcat.types.js'
import type { AnalyticsEvent } from '../events/analytics-event.types.js'
import type { ConnectorId } from '../settings/connector-settings.js'
export interface ConnectorContext {
  deviceId: string
  runAdbCommand(args: string[]): Promise<void>
}
export interface AnalyticsConnector {
  id: ConnectorId
  logcatFilters: string[]
  setup?(context: ConnectorContext): Promise<void>
  matches(entry: LogcatEntry): boolean
  parse(entry: LogcatEntry): AnalyticsEvent | null
}
