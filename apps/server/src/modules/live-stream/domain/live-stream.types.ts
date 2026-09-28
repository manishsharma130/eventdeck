import type { LiveEvent } from '../../event-rules/domain/event-rule.types.js'

export type StreamState = 'PLAYING' | 'PAUSED' | 'STOPPED'
export type LiveStreamRuntimeState = {
  selectedDeviceId: string | null
  streamState: StreamState
  isRecording: boolean
  recordingSessionId: string | null
  recordingStartedForDeviceId: string | null
}
export type RecordedSession = {
  id: string; name: string; deviceId: string; startedAt: number; endedAt: number | null; status: 'RECORDING' | 'COMPLETED'; totalEvents: number
}
export type RecordedEvent = { id: string; sessionId: string; sequence: number; event: LiveEvent; receivedAt: number }
