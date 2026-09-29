import { environment } from '../config/environment'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
export type WebSocketMessage<T = unknown> = { type: string; version: number; timestamp: number; payload: T }
type MessageListener = (message: WebSocketMessage) => void

const RECONNECT_DELAY_MS = 2_000

export class EventDeckWebSocket {
  private socket: WebSocket | undefined
  private reconnectTimer: number | undefined
  private stopped = false
  private hasAttemptedConnection = false
  private listeners = new Set<MessageListener>()

  constructor(private readonly onStatusChange: (status: ConnectionStatus) => void) {}

  connect(): void {
    this.stopped = false
    this.clearReconnectTimer()
    if (!this.hasAttemptedConnection) {
      this.onStatusChange('connecting')
      this.hasAttemptedConnection = true
    }
    const socket = new WebSocket(environment.websocketUrl)
    this.socket = socket

    socket.addEventListener('open', () => {
      if (socket !== this.socket) return
      console.info('WebSocket connected')
      this.onStatusChange('connected')
    })
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as WebSocketMessage
        this.listeners.forEach((listener) => listener(message))
      } catch { console.warn('Ignored malformed EventDeck WebSocket message.') }
    })
    socket.addEventListener('error', () => socket.close())
    socket.addEventListener('close', () => {
      if (socket !== this.socket) return
      this.socket = undefined
      this.onStatusChange('disconnected')
      if (!this.stopped) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
      }
    })
  }

  disconnect(): void {
    this.stopped = true
    this.clearReconnectTimer()
    this.socket?.close()
    this.socket = undefined
  }

  subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }
}
