import { create } from 'zustand'
import { api, type ConnectorConfiguration, type Device, type LiveEvent, type RuntimeState } from '../services/api'
import type { WebSocketMessage } from '../services/websocket'

export type StreamEvent = {
  id: string
  sequence: number
  name: string
  timestamp: string
  tag: string
  params: Record<string, unknown>
}

const emptyRuntime: RuntimeState = {
  selectedDeviceId: null,
  streamState: 'STOPPED',
  isRecording: false,
  recordingSessionId: null,
  recordingStartedForDeviceId: null,
}

let hydrationPromise: Promise<void> | null = null

const sameDevices = (left: Device[], right: Device[]) =>
  left.length === right.length && left.every((device, index) => {
    const other = right[index]
    return other?.id === device.id && other.name === device.name && other.model === device.model
  })

const sameRuntime = (left: RuntimeState, right: RuntimeState) =>
  left.selectedDeviceId === right.selectedDeviceId &&
  left.streamState === right.streamState &&
  left.isRecording === right.isRecording &&
  left.recordingSessionId === right.recordingSessionId &&
  left.recordingStartedForDeviceId === right.recordingStartedForDeviceId

type LiveStreamStore = {
  runtime: RuntimeState
  connectors: ConnectorConfiguration['connectors']
  devices: Device[]
  events: StreamEvent[]
  nextSequence: number
  selectedEventId: string | null
  query: string
  tag: string
  error: string
  notice: string
  hydrate(): Promise<void>
  setRuntime(runtime: RuntimeState): void
  setDevices(devices: Device[]): void
  setSelectedEvent(id: string | null): void
  setQuery(query: string): void
  setTag(tag: string): void
  setError(error: string): void
  setNotice(notice: string): void
  clearEvents(): void
  handleMessage(message: WebSocketMessage): void
}

export const useLiveStreamStore = create<LiveStreamStore>((set, get) => ({
  runtime: emptyRuntime,
  devices: [],
  connectors: [],
  events: [],
  nextSequence: 1,
  selectedEventId: null,
  query: '',
  tag: 'All Tags',
  error: '',
  notice: '',
  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    hydrationPromise = Promise.all([api.devices(), api.runtime(), api.connectorSettings()]).then(([devices, runtime, configuration]) => {
      set((state) => ({
        devices: sameDevices(state.devices, devices) ? state.devices : devices,
        runtime: sameRuntime(state.runtime, runtime) ? state.runtime : runtime,
        connectors: configuration.connectors,
        error: '',
      }))
    }).catch((cause) => {
      set({ error: cause instanceof Error ? cause.message : 'Could not load Live Stream state.' })
    }).finally(() => { hydrationPromise = null })
    return hydrationPromise
  },
  setRuntime: (runtime) => set({ runtime }),
  setDevices: (devices) => set((state) => sameDevices(state.devices, devices) ? state : { devices }),
  setSelectedEvent: (selectedEventId) => set({ selectedEventId }),
  setQuery: (query) => set({ query }),
  setTag: (tag) => set({ tag }),
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  clearEvents: () => set({ events: [], nextSequence: 1, selectedEventId: null, tag: 'All Tags' }),
  handleMessage: (message) => {
    if (message.type === 'connection.ready') { void get().hydrate(); return }
    if (message.type === 'live_stream.state_changed') { set({ runtime: message.payload as RuntimeState }); return }
    if (message.type === 'live_stream.device_changed') {
      const { deviceId } = message.payload as { deviceId: string }
      set((state) => ({ runtime: { ...state.runtime, selectedDeviceId: deviceId }, events: [], nextSequence: 1, selectedEventId: null, tag: 'All Tags', notice: 'Device changed. Live Stream was cleared.' }))
      return
    }
    if (message.type === 'live_stream.event') {
      const event = message.payload as LiveEvent
      set((state) => {
        const sequence = state.nextSequence
        const mapped: StreamEvent = {
          id: event.id ?? `${message.timestamp}-${sequence}`,
          sequence,
          name: event.eventName,
          tag: event.eventTag ?? 'analytics_event',
          timestamp: typeof event.timestamp === 'number' ? new Date(event.timestamp).toLocaleString() : event.timestamp ?? new Date(message.timestamp).toLocaleString(),
          params: event.eventParams,
        }
        return { events: [mapped, ...state.events].slice(0, 1000), nextSequence: sequence + 1 }
      })
      return
    }
    if (message.type === 'live_stream.parse_error' || message.type === 'live_stream.error' || message.type === 'recording.error') {
      set({ error: (message.payload as { message?: string }).message ?? 'A Live Stream error occurred.' })
    } else if (message.type === 'recording.started') set({ notice: 'Recording started.' })
    else if (message.type === 'recording.stopped') set({ notice: 'Recording saved.' })
  },
}))

// This module owns the store used by both React and a long-lived WebSocket
// listener. Fast Refresh can replace the store without replacing that listener,
// leaving incoming events in a detached store. Reload this boundary together
// so the connection and UI always share the same instance.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload())
}
