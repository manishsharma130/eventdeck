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
    const process = spawn('adb', ['-s', deviceId, 'logcat', '-v', 'raw', '-s', 'AnalyticsEvent:I', '*:S'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const lines = createInterface({ input: process.stdout })
    lines.on('line', (line) => { if (line.trim()) onMessage(line.trim()) })
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
