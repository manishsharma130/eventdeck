import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyWebSocketGateway } from '../../src/websocket/websocket.gateway.js'
import { createTestServer } from '../helpers.js'

function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => resolve(JSON.parse(data.toString())))
    socket.once('error', reject)
  })
}

describe('WebSocket foundation', () => {
  let app: FastifyInstance
  let gateway: FastifyWebSocketGateway
  let url: () => string
  let socket: WebSocket | undefined

  beforeEach(async () => {
    ;({ app, gateway, websocketUrl: url } = await createTestServer())
    await app.listen({ host: '127.0.0.1', port: 0 })
  })
  afterEach(async () => {
    socket?.close()
    gateway.close()
    await app.close()
  })

  it('sends a versioned connection.ready envelope', async () => {
    socket = new WebSocket(url())
    expect(await nextMessage(socket)).toEqual({ type: 'connection.ready', version: 1, timestamp: 1234, payload: {} })
  })

  it('broadcasts a typed envelope to connected clients', async () => {
    socket = new WebSocket(url())
    await nextMessage(socket)
    const message = nextMessage(socket)
    gateway.broadcast('server.status_changed', { status: 'ready' })
    expect(await message).toEqual({
      type: 'server.status_changed', version: 1, timestamp: 1234, payload: { status: 'ready' },
    })
  })

  it('accepts the GitHub Pages origin', async () => {
    socket = new WebSocket(url(), { origin: 'https://manishsharma130.github.io' })
    expect(await nextMessage(socket)).toEqual({
      type: 'connection.ready', version: 1, timestamp: 1234, payload: {},
    })
  })

  it('rejects browser connections from unrelated websites', async () => {
    socket = new WebSocket(url(), { origin: 'https://untrusted.example' })
    const statusCode = await new Promise<number>((resolve, reject) => {
      socket?.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
      socket?.once('error', reject)
    })
    expect(statusCode).toBe(403)
  })
})
