import pino from 'pino'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SqliteDatabase } from '../../src/database/sqlite.database.js'
import type { AdbClient } from '../../src/modules/live-stream/application/adb-client.js'
import { LiveEventBus } from '../../src/modules/live-stream/application/live-event-bus.js'
import { LiveStreamService } from '../../src/modules/live-stream/application/live-stream.service.js'
import { SqliteRecordingRepository } from '../../src/modules/live-stream/infrastructure/sqlite-recording.repository.js'
import type { WebSocketGateway } from '../../src/websocket/websocket.types.js'

describe('device-aware Live Stream recording', () => {
  const databases: SqliteDatabase[] = []
  afterEach(() => { for (const database of databases.splice(0)) database.close() })

  it('records while paused, suppresses live output, and blocks device switching', async () => {
    const database = new SqliteDatabase(':memory:')
    databases.push(database)
    const stop = vi.fn(async () => undefined)
    const adb: AdbClient = { runCommand: async () => undefined, listDevices: async () => [{ id: 'device-a', state: 'device' }], startAnalyticsLogcat: async () => ({ stop }) }
    const broadcast = vi.fn()
    const websocket: WebSocketGateway = { broadcast, sendToClient: vi.fn(), close: vi.fn() }
    const service = new LiveStreamService(adb, new SqliteRecordingRepository(database), websocket, new LiveEventBus(), pino({ level: 'silent' }), () => 100, () => `id-${Math.random()}`)
    await service.selectDevice('device-a')
    await service.startRecording('Device A session')
    service.pause()
    service.handleMessage(JSON.stringify({ eventName: 'app_open', eventTag: 'AnalyticsEvent', eventParams: { screen: 'home' } }))
    expect(service.getRecording(service.getState().recordingSessionId!).totalEvents).toBe(1)
    expect(service.getRecording(service.getState().recordingSessionId!).events[0].event.eventTag).toBe('AnalyticsEvent')
    expect(broadcast).not.toHaveBeenCalledWith('live_stream.event', expect.anything())
    await expect(service.selectDevice('device-b')).rejects.toMatchObject({ code: 'RECORDING_ACTIVE_DEVICE_CHANGE_BLOCKED' })
    expect(service.getState().selectedDeviceId).toBe('device-a')
    expect((await service.stopRecording()).status).toBe('COMPLETED')
    await service.selectDevice('device-b')
    expect(service.getState().selectedDeviceId).toBe('device-b')
    await service.close()
  })
})

describe('recording deletion', () => {
  it('deletes sessions and their events atomically while protecting the active recording', async () => {
    const database = new SqliteDatabase(':memory:')
    const repository = new SqliteRecordingRepository(database)
    const service = new LiveStreamService(
      { runCommand: async () => undefined, listDevices: async () => [], startAnalyticsLogcat: async () => ({ stop: async () => undefined }) },
      repository, { broadcast: vi.fn(), sendToClient: vi.fn(), close: vi.fn() },
      new LiveEventBus(), pino({ level: 'silent' }),
    )
    try {
      await service.selectDevice('device-a')
      const saved = await service.startRecording('Saved session')
      service.handleMessage(JSON.stringify({ eventName: 'app_open', eventParams: {} }))
      await service.stopRecording()
      const active = await service.startRecording('Active session')
      expect(() => service.deleteRecordings([saved.id, active.id])).toThrow('Stop and save')
      expect(service.getRecording(saved.id).events).toHaveLength(1)
      expect(service.deleteRecordings([saved.id, saved.id])).toEqual({ deleted: 1 })
      expect(repository.findById(saved.id)).toBeNull()
      expect(database.access((db) => db.prepare('SELECT COUNT(*) AS count FROM recorded_session_events').get())).toEqual({ count: 0 })
      expect(service.getState().recordingSessionId).toBe(active.id)
      await service.stopRecording()
      expect(service.deleteRecordings([active.id])).toEqual({ deleted: 1 })
      expect(service.listRecordings()).toEqual([])
    } finally { await service.close(); database.close() }
  })
})

describe('connector lifecycle', () => {
  it('routes mixed logs, serializes restarts, and preserves paused recording state', async () => {
    const database = new SqliteDatabase(':memory:')
    let active = 0, maximum = 0
    const filters: string[][] = []
    const runCommand = vi.fn(async () => undefined)
    const adb: AdbClient = {
      listDevices: async () => [], runCommand,
      startAnalyticsLogcat: async (_device, _line, _error, specs) => {
        active++; maximum = Math.max(maximum, active); filters.push(specs ?? [])
        return { stop: async () => { await Promise.resolve(); active-- } }
      },
    }
    const broadcast = vi.fn()
    const service = new LiveStreamService(adb, new SqliteRecordingRepository(database), { broadcast, sendToClient: vi.fn(), close: vi.fn() }, new LiveEventBus(), pino({ level: 'silent' }))
    try {
      await Promise.all([service.selectDevice('device-a'), service.play(), service.play()])
      const recording = await service.startRecording('Mixed SDKs')
      const line = (tag: string, level: string, message: string) => service.handleLogcatLine(`10-04 00:04:59.212 30977 24895 ${level} ${tag}: ${message}`)
      line('AnalyticsEvent', 'D', '{"eventName":"open","eventParams":{}}')
      line('FA-SVC', 'V', 'Logging event: origin=app,name=google,params=Bundle[{n=1}]')
      line('BranchSDK', 'V', 'setPost {"name":"purchase"}')
      line('MoEngage', 'D', 'a12 Core_EventHandler trackEvent(): { Event: {"name":"click","attributes":{"EVENT_ATTRS":"{}"}}}')
      line('Other', 'V', '{"eventName":"ignored"}')
      line('BranchSDK', 'V', 'setPost {broken}')
      expect(service.getRecording(recording.id).events.map(e => e.event.eventTag)).toEqual(['analytics_event', 'google_analytics', 'branch', 'moengage'])
      expect(broadcast.mock.calls.filter(c => c[0] === 'live_stream.event')).toHaveLength(4)
      service.pause()
      const before = service.getState()
      await Promise.all([
        service.updateConnectorSettings({ google_analytics: false, branch: false, moengage: false }),
        service.updateConnectorSettings({ google_analytics: true, branch: false, moengage: false }),
      ])
      expect(maximum).toBe(1)
      expect(filters[1]).toEqual(['AnalyticsEvent:V'])
      expect(filters[2]).toEqual(['AnalyticsEvent:V', 'FA:V', 'FA-SVC:V'])
      expect(service.getState()).toEqual(before)
      line('BranchSDK', 'V', 'setPost {"name":"disabled"}')
      line('AnalyticsEvent', 'D', '{"eventName":"still-recording"}')
      expect(service.getRecording(recording.id).totalEvents).toBe(5)
      expect(broadcast.mock.calls.filter(c => c[0] === 'live_stream.event')).toHaveLength(4)
      await service.stopRecording()
      await service.selectDevice('device-b')
      expect(runCommand).toHaveBeenCalledWith(['-s', 'device-b', 'shell', 'setprop', 'log.tag.FA', 'VERBOSE'])
    } finally { await service.close(); database.close() }
    expect(active).toBe(0)
  })
})
