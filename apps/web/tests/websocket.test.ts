import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../src/config/environment', () => ({ environment: { websocketUrl: 'ws://localhost/ws' } }))
import { EventDeckWebSocket } from '../src/services/websocket'

class FakeSocket {
  static instances: FakeSocket[] = []
  private listeners = new Map<string, Array<(event: { data?: string }) => void>>()
  constructor(_url: string) { FakeSocket.instances.push(this) }
  addEventListener(type: string, listener: (event: { data?: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  emit(type: string, data?: string) { for (const listener of this.listeners.get(type) ?? []) listener({ data }) }
  close() { this.emit('close') }
}

afterEach(() => { vi.unstubAllGlobals(); FakeSocket.instances = [] })

it('delivers live events to the current subscriber and ignores messages from disposed sockets', () => {
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  const client = new EventDeckWebSocket(vi.fn())
  const listener = vi.fn()
  client.subscribe(listener)
  client.connect()
  const oldSocket = FakeSocket.instances[0]
  const event = { type: 'live_stream.event', version: 1, timestamp: 123, payload: { eventName: 'session_start', eventTag: 'analytics_event', timestamp: 123, eventParams: {} } }
  oldSocket.emit('message', JSON.stringify(event))
  expect(listener).toHaveBeenCalledWith(event)
  client.disconnect()
  client.connect()
  oldSocket.emit('message', JSON.stringify(event))
  expect(listener).toHaveBeenCalledTimes(1)
  FakeSocket.instances[1].emit('message', JSON.stringify(event))
  expect(listener).toHaveBeenCalledTimes(2)
  client.disconnect()
})
