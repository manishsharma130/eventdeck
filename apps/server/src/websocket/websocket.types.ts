export type WebSocketMessage<T = unknown> = {
  type: string
  version: number
  timestamp: number
  payload: T
}

export interface WebSocketGateway {
  broadcast<T>(type: string, payload: T): void
  sendToClient<T>(clientId: string, type: string, payload: T): void
  close(): void
}
