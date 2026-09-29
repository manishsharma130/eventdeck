import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { AdbClient, AdbDevice, LogcatHandle } from '../application/adb-client.js'

function runAdb(arguments_: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn('adb', arguments_, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let errorOutput = ''
    process.stdout.setEncoding('utf8').on('data', (chunk: string) => { output += chunk })
    process.stderr.setEncoding('utf8').on('data', (chunk: string) => { errorOutput += chunk })
    process.once('error', reject)
    process.once('close', (code) => code === 0 ? resolve(output) : reject(new Error(errorOutput.trim() || `adb exited with code ${code}`)))
  })
}

/** Returns only the message from a tag-formatted AnalyticsEvent line. */
export function extractAnalyticsEventMessage(line: string): string | null {
  const match = line.trim().match(/^(?:[VDIWEF]\/)?AnalyticsEvent(?:\(\s*\d+\))?:\s*(.+)$/)
  return match?.[1]?.trim() || null
}

function currentLogcatTime(now = new Date()): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  return `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
}

export class RealAdbClient implements AdbClient {
  async listDevices(): Promise<AdbDevice[]> {
    const output = await runAdb(['devices', '-l'])
    return output.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
      const [id, state, ...metadata] = line.trim().split(/\s+/)
      const model = metadata.find((part) => part.startsWith('model:'))?.slice(6)
      return { id, state, ...(model ? { model } : {}) }
    })
  }

  async startAnalyticsLogcat(deviceId: string, onMessage: (message: string) => void, onError: (error: Error) => void): Promise<LogcatHandle> {
    // Keep the tag in the output so only AnalyticsEvent message payloads can
    // reach the JSON parser. :V includes events emitted with Log.d().
    const process = spawn('adb', ['-s', deviceId, 'logcat', '-v', 'tag', '-T', currentLogcatTime(), '-s', 'AnalyticsEvent:V', '*:S'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const lines = createInterface({ input: process.stdout })
    lines.on('line', (line) => {
      const message = extractAnalyticsEventMessage(line)
      if (message) onMessage(message)
    })
    process.stderr.setEncoding('utf8').on('data', (chunk: string) => onError(new Error(chunk.trim())))
    process.once('error', onError)
    return {
      stop: () => new Promise((resolve) => {
        if (process.exitCode !== null || process.killed) return resolve()
        process.once('close', () => resolve())
        process.kill('SIGTERM')
      }),
    }
  }
}
