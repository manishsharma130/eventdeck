import { environment } from '../config/environment'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

const ECHO_MESSAGE = 'Hello EventDeck'
const RECONNECT_DELAY_MS = 2_000

export class EventDeckWebSocket {
  private socket: WebSocket | undefined
  private reconnectTimer: number | undefined
  private stopped = false

  constructor(private readonly onStatusChange: (status: ConnectionStatus) => void) {}

  connect(): void {
    this.stopped = false
    this.clearReconnectTimer()
    this.onStatusChange('connecting')
    const socket = new WebSocket(environment.websocketUrl)
    this.socket = socket

    socket.addEventListener('open', () => {
      if (socket !== this.socket) return
      console.info('WebSocket connected')
      this.onStatusChange('connected')
      socket.send(ECHO_MESSAGE)
    })
    socket.addEventListener('message', (event) => console.info('Echo response:', event.data))
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

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }
}
