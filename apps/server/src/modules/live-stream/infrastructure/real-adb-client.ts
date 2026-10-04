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

function currentLogcatTime(now = new Date()): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  return `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
}

export class RealAdbClient implements AdbClient {
  async runCommand(args: string[]): Promise<void> { await runAdb(args) }

  async listDevices(): Promise<AdbDevice[]> {
    const output = await runAdb(['devices', '-l'])
    return output.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
      const [id, state, ...metadata] = line.trim().split(/\s+/)
      const model = metadata.find((part) => part.startsWith('model:'))?.slice(6)
      return { id, state, ...(model ? { model } : {}) }
    })
  }

  async startAnalyticsLogcat(deviceId: string, onMessage: (message: string) => void, onError: (error: Error) => void, filters = ['AnalyticsEvent:V']): Promise<LogcatHandle> {
    const process = spawn('adb', ['-s', deviceId, 'logcat', '-v', 'threadtime', '-T', currentLogcatTime(), ...filters, '*:S'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const lines = createInterface({ input: process.stdout })
    lines.on('line', onMessage)
    process.stderr.setEncoding('utf8').on('data', (chunk: string) => onError(new Error(chunk.trim())))
    try {
      await new Promise<void>((resolve, reject) => { process.once('spawn', resolve); process.once('error', reject) })
    } catch (error) { lines.close(); throw error }
    process.on('error', onError)
    let stopping = false
    process.once('close', (code) => { lines.close(); if (!stopping) onError(new Error(`ADB Logcat exited (${code})`)) })
    return {
      stop: () => new Promise((resolve) => {
        stopping = true
        if (process.exitCode !== null || process.signalCode != null) return resolve()
        const timeout = setTimeout(() => process.kill('SIGKILL'), 2000)
        timeout.unref()
        process.once('close', () => { clearTimeout(timeout); resolve() })
        process.kill('SIGTERM')
      }),
    }
  }
}
