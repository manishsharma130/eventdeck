import { environment } from '../config/environment'

export type MatchType = 'exact' | 'contains' | 'exists' | 'regex'
export type EventRule = { id: string; paramKey: string; matchType: MatchType; expectedValue?: string }
export type EventDefinition = { id: string; name: string; eventValue: string; rules: EventRule[]; createdAt: number; updatedAt: number }
export type EventDefinitionInput = { name: string; eventValue: string; rules: Array<Omit<EventRule, 'id'>> }
export type FlowEvent = { id: string; flowId: string; eventDefinitionId: string; position: number; definition?: EventDefinition }
export type Flow = { id: string; name: string; events: FlowEvent[]; createdAt: number; updatedAt: number }
export type Device = { id: string; name?: string; type?: string; model?: string }
export type StreamState = 'PLAYING' | 'PAUSED' | 'STOPPED'
export type RuntimeState = { selectedDeviceId: string | null; streamState: StreamState; isRecording: boolean; recordingSessionId: string | null; recordingStartedForDeviceId?: string | null }
export type LiveEvent = { id?: string; eventName: string; eventTag?: string; timestamp?: string | number; eventParams: Record<string, unknown> }
export type RecordedSession = { id: string; name: string; deviceId: string; startedAt: number; endedAt: number | null; status: 'RECORDING' | 'COMPLETED'; totalEvents: number }
export type SelectedFlow = { flowId: string; name: string; position: number; events: Array<{ flowEventId: string; eventDefinitionId: string; eventName: string; eventDefinitionName: string; position: number; rules: EventRule[]; status?: 'PENDING' | 'PASSED' | 'FAILED' }> }
export type ExecutionState = { active: boolean; flows: Array<SelectedFlow & { flowIndex: number }>; completion?: Completion | null }
export type Completion = { reason: string; flows: Array<{ flowId: string; flowIndex: number; name: string; totalEvents: number; passedEvents: number; failedEvents: number; status: 'PASSED' | 'PARTIAL' | 'FAILED'; events: Array<{ flowEventId: string; eventDefinitionId: string; eventIndex: number; status: 'PASSED' | 'FAILED' }> }> }

export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: unknown, public status = 0) { super(message) }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs: number | null = 10_000): Promise<T> {
  const controller = new AbortController()
  const timeout = timeoutMs === null ? undefined : window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) abort()
  else init.signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(`${environment.apiUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }, signal: controller.signal })
    const body = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error
      throw new ApiError(error?.code ?? 'REQUEST_FAILED', error?.message ?? `Request failed (${response.status}).`, error?.details, response.status)
    }
    return body as T
  } catch (error) {
    if (init.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError')
    if (error instanceof ApiError) throw error
    throw new ApiError(error instanceof DOMException && error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'SERVER_UNREACHABLE', error instanceof DOMException && error.name === 'AbortError' ? 'The server did not respond in time.' : 'Could not reach the EventDeck server.')
  } finally { if (timeout !== undefined) window.clearTimeout(timeout); init.signal?.removeEventListener('abort', abort) }
}

const body = (value: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(value) })
export type ConnectorSettings = { google_analytics: boolean; branch: boolean; moengage: boolean }
export type ConnectorConfiguration = { settings: ConnectorSettings; connectors: Array<{ id: string; label: string; configurable: boolean }> }
export type StorageModuleId = 'recordings' | 'rules' | 'build' | 'execution'
export type StorageUsage = {
  totalBytes: number
  measurement: 'stored_payload_bytes'
  modules: Array<{ id: StorageModuleId; name: string; bytes: number; clears: StorageModuleId[] }>
}
export type StorageOperation = {
  id: string
  target: StorageModuleId | 'all'
  affected: StorageModuleId[]
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'
  error: string | null
  startedAt: number
  completedAt: number | null
}
export type StorageStatus = {
  deletionAllowed: boolean
  blockers: Array<'LIVE_STREAM_PLAYING' | 'RECORDING_ACTIVE' | 'VALIDATION_ACTIVE' | 'DELETION_ACTIVE'>
  operation: StorageOperation | null
}
export const api = {
  storage: (signal?: AbortSignal) => request<StorageUsage>('/api/storage', { signal }, null),
  storageStatus: () => request<StorageStatus>('/api/storage/status'),
  clearStorage: (operationId: string, target: StorageModuleId | 'all') => request<StorageOperation>('/api/storage/clear', body({ operationId, target, confirmed: true }), null),
  connectorSettings: () => request<ConnectorConfiguration>('/api/settings/connectors'),
  updateConnectorSettings: (settings: ConnectorSettings) => request<ConnectorConfiguration>('/api/settings/connectors', body(settings, 'PUT')),
  health: () => request<{ status: string }>('/health'),
  status: () => request<{ server: string; database: string; version: string }>('/api/status'),
  devices: () => request<Device[]>('/api/devices'),
  runtime: () => request<RuntimeState>('/api/live-stream/state'),
  selectDevice: (deviceId: string) => request<RuntimeState>('/api/live-stream/device', body({ deviceId }, 'PUT')),
  stream: (action: 'play' | 'pause' | 'stop') => request<RuntimeState>(`/api/live-stream/${action}`, body({})),
  startRecording: (name: string) => request<RecordedSession>('/api/live-stream/recording/start', body({ name })),
  stopRecording: (name?: string) => request<RecordedSession>('/api/live-stream/recording/stop', body({ name })),
  recordings: () => request<RecordedSession[]>('/api/recorded-sessions'),
  recording: (id: string) => request<RecordedSession & { events: Array<{ id: string; sequence: number; receivedAt: number; event: LiveEvent }> }>(`/api/recorded-sessions/${id}`),
  deleteRecordings: (ids: string[]) => request<{ deleted: number }>('/api/recorded-sessions', body({ ids }, 'DELETE')),
  rules: () => request<EventDefinition[]>('/api/event-rules'),
  ruleUsage: (id: string) => request<{ flowCount: number }>(`/api/event-rules/${id}/usage`),
  rulesUsage: (ids: string[]) => request<{ flowCount: number }>('/api/event-rules/usage', body({ ids })),
  createRule: (input: EventDefinitionInput) => request<EventDefinition>('/api/event-rules', body(input)),
  updateRule: (id: string, input: EventDefinitionInput) => request<EventDefinition>(`/api/event-rules/${id}`, body(input, 'PUT')),
  deleteRule: (id: string) => request<{ deleted: true; affectedFlows: number }>(`/api/event-rules/${id}`, { method: 'DELETE' }),
  deleteRules: (ids: string[]) => request<{ deleted: number; affectedFlows: number }>('/api/event-rules', body({ ids }, 'DELETE')),
  flows: (search?: string) => request<Flow[]>(`/api/flows${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createFlow: (name: string, eventDefinitionIds: string[]) => request<Flow>('/api/flows', body({ name, eventDefinitionIds })),
  updateFlow: (id: string, name: string, eventDefinitionIds: string[]) => request<Flow>(`/api/flows/${id}`, body({ name, eventDefinitionIds }, 'PUT')),
  deleteFlow: (id: string) => request<{ deleted: true }>(`/api/flows/${id}`, { method: 'DELETE' }),
  deleteFlows: (ids: string[]) => request<{ deleted: number }>('/api/flows', body({ ids }, 'DELETE')),
  selectedFlows: () => request<SelectedFlow[]>('/api/flow-execution'),
  replaceSelectedFlows: (flowIds: string[]) => request<SelectedFlow[]>('/api/flow-execution/selected-flows', body({ flowIds }, 'PUT')),
  execution: () => request<ExecutionState>('/api/flow-execution/status'),
  validate: (recordedSessionId?: string) => request<{ status: 'started'; flows: ExecutionState['flows'] } | Completion>('/api/flow-execution/validate', body({ recordedSessionId })),
  stopValidation: () => request<Completion>('/api/flow-execution/stop', body({ reason: 'USER_STOPPED' })),
  resetValidation: () => request<{ status: 'reset'; flows: ExecutionState['flows'] }>('/api/flow-execution/reset', body({})),
}
