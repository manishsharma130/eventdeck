import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawn = vi.fn()
vi.mock('node:child_process', () => ({ spawn }))

describe('RealAdbClient', () => {
  beforeEach(() => spawn.mockReset())

  it('streams raw lines using threadtime and device-scoped dynamic filters', async () => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; exitCode: number | null; killed: boolean; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.exitCode = null
    child.killed = false
    child.kill = vi.fn()
    spawn.mockImplementation(() => { queueMicrotask(() => child.emit('spawn')); return child })
    const { RealAdbClient } = await import('../../src/modules/live-stream/infrastructure/real-adb-client.js')

    const messages: string[] = []
    await new RealAdbClient().startAnalyticsLogcat('emulator-5554', (message) => messages.push(message), vi.fn(), ['AnalyticsEvent:V', 'BranchSDK:V'])
    child.stdout.write('--------- beginning of main\n')
    child.stdout.write('D/OtherTag: {"eventName":"wrong_tag"}\n')
    child.stdout.write('D/AnalyticsEvent: {"eventName":"debug_event","eventParams":{}}\n')

    expect(spawn).toHaveBeenCalledTimes(1)
    const arguments_ = spawn.mock.calls[0][1] as string[]
    expect(arguments_.slice(0, 6)).toEqual(['-s', 'emulator-5554', 'logcat', '-v', 'threadtime', '-T'])
    expect(arguments_[6]).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/)
    expect(arguments_.slice(7)).toEqual(['AnalyticsEvent:V', 'BranchSDK:V', '*:S'])
    expect(messages).toHaveLength(3)
  })

  it('rejects when adb cannot be spawned', async () => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough }
    child.stdout = new PassThrough(); child.stderr = new PassThrough()
    spawn.mockImplementationOnce(() => { queueMicrotask(() => child.emit('error', new Error('ENOENT'))); return child })
    const { RealAdbClient } = await import('../../src/modules/live-stream/infrastructure/real-adb-client.js')
    await expect(new RealAdbClient().startAnalyticsLogcat('device', vi.fn(), vi.fn())).rejects.toThrow('ENOENT')
  })
})
