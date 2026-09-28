import { randomUUID } from 'node:crypto'
import { WebSocket } from 'ws'
import type { AppLogger } from '../logging/logger.js'
import { websocketEvents } from './websocket.events.js'
import type { WebSocketGateway, WebSocketMessage } from './websocket.types.js'

export class FastifyWebSocketGateway implements WebSocketGateway {
  private readonly clients = new Map<string, WebSocket>()

  constructor(private readonly logger: AppLogger, private readonly now: () => number = Date.now) {}

  addClient(socket: WebSocket): string {
    const clientId = randomUUID()
    this.clients.set(clientId, socket)
    this.logger.info({ clientId }, 'WebSocket client connected')
    socket.once('close', () => {
      this.clients.delete(clientId)
      this.logger.info({ clientId }, 'WebSocket client disconnected')
    })
    this.sendToClient(clientId, websocketEvents.connectionReady, {})
    return clientId
  }

  broadcast<T>(type: string, payload: T): void {
    const message = this.serialize(type, payload)
    for (const socket of this.clients.values()) if (socket.readyState === WebSocket.OPEN) socket.send(message)
  }

  sendToClient<T>(clientId: string, type: string, payload: T): void {
    const socket = this.clients.get(clientId)
    if (socket?.readyState === WebSocket.OPEN) socket.send(this.serialize(type, payload))
  }

  close(): void {
    for (const socket of this.clients.values()) socket.close(1001, 'Server shutting down')
    this.clients.clear()
  }

  private serialize<T>(type: string, payload: T): string {
    const message: WebSocketMessage<T> = { type, version: 1, timestamp: this.now(), payload }
    return JSON.stringify(message)
  }
}
