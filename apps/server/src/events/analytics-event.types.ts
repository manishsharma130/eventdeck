export interface AnalyticsEvent {
  [key: string]: unknown
  eventName: string
  eventTag: string
  timestamp: number
  eventParams: Record<string, unknown>
}
