import { ConnectorRegistry } from '../../../connectors/connector-registry.js'
import { analyticsEventConnector } from '../../../connectors/analytics-event/analytics-event.connector.js'
import { parseLogcatEntry } from '../../../logcat/logcat-line-parser.js'
import { CONNECTOR_METADATA, DEFAULT_CONNECTOR_SETTINGS, type ConnectorSettings } from '../../../settings/connector-settings.js'
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
  private readonly registry = new ConnectorRegistry()
  private connectorSettings = { ...DEFAULT_CONNECTOR_SETTINGS }
  private operations: Promise<unknown> = Promise.resolve()
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation)
    this.operations = result.catch(() => undefined)
    return result
  }
  getConnectorSettings() { return { settings: { ...this.connectorSettings }, connectors: CONNECTOR_METADATA } }
  updateConnectorSettings(settings: ConnectorSettings) {
    return this.enqueue(async () => {
      const previous = this.connectorSettings
      if (JSON.stringify(previous) === JSON.stringify(settings)) return this.getConnectorSettings()
      const active = !!this.logcat
      await this.stopLogcat()
      this.connectorSettings = { ...settings }
      try {
        if (active) await this.startLogcat()
        else if (!previous.google_analytics && settings.google_analytics && this.state.selectedDeviceId) {
          await this.registry.setup(settings, { deviceId: this.state.selectedDeviceId, runAdbCommand: args => this.adb.runCommand(args) })
        }
      } catch (error) {
        this.connectorSettings = previous
        if (active) await this.startLogcat().catch(() => undefined)
        throw error
      }
      return this.getConnectorSettings()
    })
  }
  private logcatGeneration = 0
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

  selectDevice(deviceId: string) { return this.enqueue(() => this.selectDeviceInternal(deviceId)) }

  private async selectDeviceInternal(deviceId: string): Promise<LiveStreamRuntimeState> {
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

  play() { return this.enqueue(() => this.playInternal()) }

  private async playInternal(): Promise<LiveStreamRuntimeState> {
    if (!this.state.selectedDeviceId) throw new AppError('DEVICE_NOT_SELECTED', 'Select an Android device before starting Live Stream.', 400)
    await this.startLogcat()
    this.state.streamState = 'PLAYING'
    this.publishState()
    return this.getState()
  }
  pause(): LiveStreamRuntimeState { this.state.streamState = 'PAUSED'; this.publishState(); return this.getState() }
  stop() { return this.enqueue(() => this.stopInternal()) }

  private async stopInternal(): Promise<LiveStreamRuntimeState> {
    this.state.streamState = 'STOPPED'
    if (!this.state.isRecording) await this.stopLogcat()
    this.publishState()
    return this.getState()
  }

  startRecording(name: string) { return this.enqueue(() => this.startRecordingInternal(name)) }

  private async startRecordingInternal(name: string): Promise<RecordedSession> {
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

  stopRecording(name?: string) { return this.enqueue(() => this.stopRecordingInternal(name)) }

  private async stopRecordingInternal(name?: string): Promise<RecordedSession> {
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

  deleteRecordings(ids: string[]): { deleted: number } {
    if (this.state.recordingSessionId && ids.includes(this.state.recordingSessionId)) {
      throw new AppError('RECORDING_ACTIVE', 'Stop and save the active recording before deleting it.', 409)
    }
    return { deleted: this.recordings.deleteMany([...new Set(ids)]) }
  }

  handleMessage(message: string): void {
    const event = analyticsEventConnector.parse({ timestamp: this.now(), level: 'V', tag: 'AnalyticsEvent', message, raw: message })
    if (event) this.publishEvent(event)
  }

  handleLogcatLine(line: string): void {
    const entry = parseLogcatEntry(line, this.now())
    if (!entry) return
    const event = this.registry.parse(entry, this.connectorSettings)
    if (event) this.publishEvent(event)
  }

  private publishEvent(event: LiveEvent): void {
    const receivedAt = this.now()
    if (this.state.isRecording && this.state.recordingSessionId) {
      this.recordings.append(this.state.recordingSessionId, {
        id: this.id(), sessionId: this.state.recordingSessionId, sequence: this.recordings.nextSequence(this.state.recordingSessionId), event, receivedAt,
      })
    }
    this.eventBus.publish(event)
    if (this.state.streamState === 'PLAYING') this.websocket.broadcast('live_stream.event', event)
  }

  async close(): Promise<void> { await this.enqueue(() => this.stopLogcat()) }

  private async startLogcat(): Promise<void> {
    if (this.logcat || !this.state.selectedDeviceId) return
    const generation = ++this.logcatGeneration
    try {
      await this.registry.setup(this.connectorSettings, { deviceId: this.state.selectedDeviceId, runAdbCommand: args => this.adb.runCommand(args) })
      this.logcat = await this.adb.startAnalyticsLogcat(this.state.selectedDeviceId, (line) => this.handleLogcatLine(line), (error) => {
        void this.enqueue(async () => { if (generation === this.logcatGeneration) await this.stopLogcat() })
        this.logger.error({ err: error, deviceId: this.state.selectedDeviceId }, 'ADB Logcat error')
        this.websocket.broadcast('live_stream.error', { code: 'ADB_LOGCAT_ERROR', message: error.message })
      }, this.registry.getFilters(this.connectorSettings))
    } catch (error) {
      throw new AppError('ADB_LOGCAT_START_FAILED', `Unable to start analytics Logcat: ${error instanceof Error ? error.message : String(error)}`, 503)
    }
  }
  private async stopLogcat(): Promise<void> { this.logcatGeneration++; const current = this.logcat; this.logcat = null; await current?.stop() }
  private publishState(): void { this.websocket.broadcast('live_stream.state_changed', this.getState()) }
}
