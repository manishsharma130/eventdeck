export type AdbDevice = { id: string; state: string; model?: string }
export type LogcatHandle = { stop(): Promise<void> }
export interface AdbClient {
  listDevices(): Promise<AdbDevice[]>
  startAnalyticsLogcat(deviceId: string, onMessage: (message: string) => void, onError: (error: Error) => void): Promise<LogcatHandle>
}
