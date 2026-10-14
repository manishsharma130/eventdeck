export type AdbDevice = { id: string; state: string; model?: string }
export type LogcatHandle = { stop(): Promise<void> }
export class AdbLogcatExitError extends Error {
  constructor(public readonly exitCode: number | null) {
    super(`ADB Logcat exited (${exitCode})`)
    this.name = 'AdbLogcatExitError'
  }
}
export interface AdbClient {
  runCommand(args: string[]): Promise<void>
  listDevices(): Promise<AdbDevice[]>
  startAnalyticsLogcat(deviceId: string, onMessage: (message: string) => void, onError: (error: Error) => void, filters?: string[]): Promise<LogcatHandle>
}
