import { randomUUID } from 'node:crypto'
import type { AppLogger } from '../../../logging/logger.js'
import { AppError } from '../../../shared/errors/app-error.js'
import type { WebSocketGateway } from '../../../websocket/websocket.types.js'
import type { LiveEvent } from '../../event-rules/domain/event-rule.types.js'
import type { LiveStreamRuntimeState, RecordedSession } from '../domain/live-stream.types.js'
import type { AdbClient, AdbDevice, LogcatHandle } from './adb-client.js'
import type { LiveEventBus } from './live-event-bus.js'
import type { RecordingRepository } from './recording.repository.js'

export class LiveStreamService {
  private state: LiveStreamRuntimeState = {
    selectedDeviceId: null, streamState: 'STOPPED', isRecording: false, recordingSessionId: null, recordingStartedForDeviceId: null,
  }
  private logcat: LogcatHandle | null = null

  constructor(
    private readonly adb: AdbClient,
    private readonly recordings: RecordingRepository,
    private readonly websocket: WebSocketGateway,
    private readonly eventBus: LiveEventBus,
    private readonly logger: AppLogger,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID,
  ) {}

  getState(): LiveStreamRuntimeState { return { ...this.state } }
  async listDevices(): Promise<AdbDevice[]> {
    try { return await this.adb.listDevices() } catch (error) { throw new AppError('ADB_UNAVAILABLE', `Unable to list Android devices: ${error instanceof Error ? error.message : String(error)}`, 503) }
  }

  async selectDevice(deviceId: string): Promise<LiveStreamRuntimeState> {
    const normalized = deviceId.trim()
    if (!normalized) throw new AppError('INVALID_DEVICE', 'Device ID is required.', 400)
    if (this.state.isRecording) throw new AppError('RECORDING_ACTIVE_DEVICE_CHANGE_BLOCKED', 'Stop and save the active recording before changing device.', 409, {
      reason: 'RECORDING_ACTIVE', currentDeviceId: this.state.recordingStartedForDeviceId, requestedDeviceId: normalized,
    })
    if (normalized === this.state.selectedDeviceId) return this.getState()
    await this.stopLogcat()
    this.state.selectedDeviceId = normalized
    await this.startLogcat()
    this.websocket.broadcast('live_stream.device_changed', { deviceId: normalized, clearStream: true })
    return this.getState()
  }

  async play(): Promise<LiveStreamRuntimeState> {
    if (!this.state.selectedDeviceId) throw new AppError('DEVICE_NOT_SELECTED', 'Select an Android device before starting Live Stream.', 400)
    await this.startLogcat()
    this.state.streamState = 'PLAYING'
    this.publishState()
    return this.getState()
  }
  pause(): LiveStreamRuntimeState { this.state.streamState = 'PAUSED'; this.publishState(); return this.getState() }
  async stop(): Promise<LiveStreamRuntimeState> {
    this.state.streamState = 'STOPPED'
    if (!this.state.isRecording) await this.stopLogcat()
    this.publishState()
    return this.getState()
  }

  async startRecording(name: string): Promise<RecordedSession> {
    if (this.state.isRecording) throw new AppError('RECORDING_ALREADY_ACTIVE', 'A recording is already active.', 409)
    if (!this.state.selectedDeviceId) throw new AppError('DEVICE_NOT_SELECTED', 'Select an Android device before recording.', 400)
    const normalizedName = name.trim()
    if (!normalizedName) throw new AppError('INVALID_RECORDING_NAME', 'Recording name is required.', 400)
    await this.startLogcat()
    const session: RecordedSession = {
      id: this.id(), name: normalizedName, deviceId: this.state.selectedDeviceId, startedAt: this.now(), endedAt: null, status: 'RECORDING', totalEvents: 0,
    }
    this.recordings.start(session)
    this.state.isRecording = true
    this.state.recordingSessionId = session.id
    this.state.recordingStartedForDeviceId = this.state.selectedDeviceId
    this.websocket.broadcast('recording.started', session)
    this.publishState()
    return session
  }

  async stopRecording(name?: string): Promise<RecordedSession> {
    if (!this.state.isRecording || !this.state.recordingSessionId) throw new AppError('RECORDING_NOT_ACTIVE', 'No recording is active.', 409)
    const current = this.recordings.findById(this.state.recordingSessionId)
    if (!current) throw new AppError('RECORDING_NOT_FOUND', 'The active recording session was not found.', 500)
    const finalName = name?.trim() || current.name
    if (!finalName) throw new AppError('INVALID_RECORDING_NAME', 'Recording name is required.', 400)
    const completed = this.recordings.complete(current.id, finalName, this.now())
    this.state.isRecording = false
    this.state.recordingSessionId = null
    this.state.recordingStartedForDeviceId = null
    this.websocket.broadcast('recording.stopped', completed)
    this.publishState()
    if (this.state.streamState === 'STOPPED') await this.stopLogcat()
    return completed
  }

  listRecordings(): RecordedSession[] { return this.recordings.list() }
  getRecording(id: string): NonNullable<ReturnType<RecordingRepository['findById']>> {
    const session = this.recordings.findById(id)
    if (!session) throw new AppError('RECORDING_NOT_FOUND', 'Recorded session was not found.', 404)
    return session
  }

  handleMessage(message: string): void {
    let event: LiveEvent
    try {
      const parsed = JSON.parse(message) as unknown
      if (!parsed || typeof parsed !== 'object' || typeof (parsed as LiveEvent).eventName !== 'string') throw new Error('eventName must be a string')
      const candidate = parsed as LiveEvent
      event = { ...candidate, eventParams: candidate.eventParams && typeof candidate.eventParams === 'object' && !Array.isArray(candidate.eventParams) ? candidate.eventParams : {} }
    } catch (error) {
      this.logger.warn({ err: error }, 'Ignoring invalid AnalyticsEvent Logcat message')
      this.websocket.broadcast('live_stream.parse_error', { message: 'AnalyticsEvent message was not valid event JSON.' })
      return
    }
    const receivedAt = this.now()
    if (this.state.isRecording && this.state.recordingSessionId) {
      this.recordings.append(this.state.recordingSessionId, {
        id: this.id(), sessionId: this.state.recordingSessionId, sequence: this.recordings.nextSequence(this.state.recordingSessionId), event, receivedAt,
      })
    }
    this.eventBus.publish(event)
    if (this.state.streamState === 'PLAYING') this.websocket.broadcast('live_stream.event', event)
  }

  async close(): Promise<void> { await this.stopLogcat() }

  private async startLogcat(): Promise<void> {
    if (this.logcat || !this.state.selectedDeviceId) return
    try {
      this.logcat = await this.adb.startAnalyticsLogcat(this.state.selectedDeviceId, (message) => this.handleMessage(message), (error) => {
        this.logger.error({ err: error, deviceId: this.state.selectedDeviceId }, 'ADB Logcat error')
        this.websocket.broadcast('live_stream.error', { code: 'ADB_LOGCAT_ERROR', message: error.message })
      })
    } catch (error) {
      throw new AppError('ADB_LOGCAT_START_FAILED', `Unable to start AnalyticsEvent Logcat: ${error instanceof Error ? error.message : String(error)}`, 503)
    }
  }
  private async stopLogcat(): Promise<void> { const current = this.logcat; this.logcat = null; await current?.stop() }
  private publishState(): void { this.websocket.broadcast('live_stream.state_changed', this.getState()) }
}
