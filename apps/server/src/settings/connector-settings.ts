export const CONNECTOR_METADATA = [
  { id: 'analytics_event', label: 'AnalyticsEvent', configurable: false },
  { id: 'google_analytics', label: 'GoogleAnalytics', configurable: true },
  { id: 'branch', label: 'Branch', configurable: true },
  { id: 'moengage', label: 'Moengage', configurable: true },
] as const
export type ConnectorId = typeof CONNECTOR_METADATA[number]['id']
export type ConnectorSettings = Record<Exclude<ConnectorId, 'analytics_event'>, boolean>
export const DEFAULT_CONNECTOR_SETTINGS: ConnectorSettings = { google_analytics: true, branch: true, moengage: true }
