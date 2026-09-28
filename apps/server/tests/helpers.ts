import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import pino from 'pino'
import { createServer } from '../src/server/create-server.js'
import type { Database } from '../src/database/database.types.js'
import { FastifyWebSocketGateway } from '../src/websocket/websocket.gateway.js'

export class FakeDatabase implements Database {
  closed = false
  transaction<T>(operation: () => T): T { return operation() }
  isHealthy(): boolean { return !this.closed }
  close(): void { this.closed = true }
}

export async function createTestServer(): Promise<{
  app: FastifyInstance
  gateway: FastifyWebSocketGateway
  websocketUrl(): string
}> {
  const logger = pino({ level: 'silent' })
  const gateway = new FastifyWebSocketGateway(logger, () => 1234)
  const app = await createServer({ database: new FakeDatabase(), logger, websocketGateway: gateway, version: 'test' })
  return {
    app,
    gateway,
    websocketUrl: () => `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/ws`,
  }
}
