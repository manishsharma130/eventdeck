import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import pino from 'pino'
import { createServer } from '../src/server/create-server.js'
import { FastifyWebSocketGateway } from '../src/websocket/websocket.gateway.js'
import { SqliteDatabase } from '../src/database/sqlite.database.js'
import { createDependencies } from '../src/server/create-dependencies.js'
import type { AppDependencies } from '../src/server/server.types.js'
import type { AdbClient } from '../src/modules/live-stream/application/adb-client.js'

export const fakeAdbClient: AdbClient = {
  listDevices: async () => [],
  startAnalyticsLogcat: async () => ({ stop: async () => undefined }),
}

export async function createTestServer(): Promise<{
  app: FastifyInstance
  gateway: FastifyWebSocketGateway
  dependencies: AppDependencies
  websocketUrl(): string
}> {
  const logger = pino({ level: 'silent' })
  const gateway = new FastifyWebSocketGateway(logger, () => 1234)
  const database = new SqliteDatabase(':memory:')
  const dependencies = createDependencies(database, logger, gateway, fakeAdbClient, 'test')
  const app = await createServer(dependencies)
  app.addHook('onClose', async () => { await dependencies.liveStreamService.close(); database.close() })
  return {
    app,
    gateway,
    dependencies,
    websocketUrl: () => `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/ws`,
  }
}
