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
export type LiveEvent = { id?: string; eventName: string; eventTag?: string; timestamp?: string; eventParams: Record<string, unknown> }
export type RecordedSession = { id: string; name: string; deviceId: string; startedAt: number; endedAt: number | null; status: 'RECORDING' | 'COMPLETED'; totalEvents: number }
export type SelectedFlow = { flowId: string; name: string; position: number; events: Array<{ flowEventId: string; eventDefinitionId: string; eventName: string; eventDefinitionName: string; position: number; rules: EventRule[]; status?: 'PENDING' | 'PASSED' | 'FAILED' }> }
export type ExecutionState = { active: boolean; flows: Array<SelectedFlow & { flowIndex: number }> }
export type Completion = { reason: string; flows: Array<{ flowId: string; flowIndex: number; name: string; totalEvents: number; passedEvents: number; failedEvents: number; status: 'PASSED' | 'PARTIAL' | 'FAILED'; events: Array<{ flowEventId: string; eventDefinitionId: string; eventIndex: number; status: 'PASSED' | 'FAILED' }> }> }

export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: unknown, public status = 0) { super(message) }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${environment.apiUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }, signal: controller.signal })
    const body = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error
      throw new ApiError(error?.code ?? 'REQUEST_FAILED', error?.message ?? `Request failed (${response.status}).`, error?.details, response.status)
    }
    return body as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error instanceof DOMException && error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'SERVER_UNREACHABLE', error instanceof DOMException && error.name === 'AbortError' ? 'The server did not respond in time.' : 'Could not reach the EventDeck server.')
  } finally { window.clearTimeout(timeout) }
}

const body = (value: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(value) })
export const api = {
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
}
