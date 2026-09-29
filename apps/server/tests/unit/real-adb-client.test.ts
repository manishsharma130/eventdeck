import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawn = vi.fn()
vi.mock('node:child_process', () => ({ spawn }))

describe('RealAdbClient', () => {
  beforeEach(() => spawn.mockReset())

  it('captures all priorities for the device-scoped AnalyticsEvent tag', async () => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; exitCode: number | null; killed: boolean; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.exitCode = null
    child.killed = false
    child.kill = vi.fn()
    spawn.mockReturnValue(child)
    const { RealAdbClient } = await import('../../src/modules/live-stream/infrastructure/real-adb-client.js')

    const messages: string[] = []
    await new RealAdbClient().startAnalyticsLogcat('emulator-5554', (message) => messages.push(message), vi.fn())
    child.stdout.write('--------- beginning of main\n')
    child.stdout.write('D/OtherTag: {"eventName":"wrong_tag"}\n')
    child.stdout.write('D/AnalyticsEvent: {"eventName":"debug_event","eventParams":{}}\n')

    expect(spawn).toHaveBeenCalledTimes(1)
    const arguments_ = spawn.mock.calls[0][1] as string[]
    expect(arguments_.slice(0, 6)).toEqual(['-s', 'emulator-5554', 'logcat', '-v', 'tag', '-T'])
    expect(arguments_[6]).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/)
    expect(arguments_.slice(7)).toEqual(['-s', 'AnalyticsEvent:V', '*:S'])
    expect(messages).toEqual(['{"eventName":"debug_event","eventParams":{}}'])
  })

  it('extracts only the AnalyticsEvent message portion', async () => {
    const { extractAnalyticsEventMessage } = await import('../../src/modules/live-stream/infrastructure/real-adb-client.js')
    expect(extractAnalyticsEventMessage('I/AnalyticsEvent( 1234): {"eventName":"open"}')).toBe('{"eventName":"open"}')
    expect(extractAnalyticsEventMessage('AnalyticsEvent: {"eventName":"open"}')).toBe('{"eventName":"open"}')
    expect(extractAnalyticsEventMessage('D/OtherTag: {"eventName":"open"}')).toBeNull()
    expect(extractAnalyticsEventMessage('--------- beginning of main')).toBeNull()
  })
})
