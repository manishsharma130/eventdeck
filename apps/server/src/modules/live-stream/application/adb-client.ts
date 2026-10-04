export type AdbDevice = { id: string; state: string; model?: string }
export type LogcatHandle = { stop(): Promise<void> }
export interface AdbClient {
  runCommand(args: string[]): Promise<void>
  listDevices(): Promise<AdbDevice[]>
  startAnalyticsLogcat(deviceId: string, onMessage: (message: string) => void, onError: (error: Error) => void, filters?: string[]): Promise<LogcatHandle>
}
