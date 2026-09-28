import type { FastifyInstance } from 'fastify'
import { loadConfig } from '../config/config.js'
import type { AppConfig } from '../config/config.schema.js'
import { SqliteDatabase } from '../database/sqlite.database.js'
import { createLogger, type AppLogger } from '../logging/logger.js'
import { FastifyWebSocketGateway } from '../websocket/websocket.gateway.js'
import { RealAdbClient } from '../modules/live-stream/infrastructure/real-adb-client.js'
import { createDependencies } from './create-dependencies.js'
import { createServer } from './create-server.js'

export type ServerRuntime = {
  app: FastifyInstance
  config: AppConfig
  logger: AppLogger
  close(): Promise<void>
}

export async function startServer(environment: NodeJS.ProcessEnv = process.env): Promise<ServerRuntime> {
  const config = loadConfig(environment)
  const logger = createLogger(config.logLevel)
  const database = new SqliteDatabase(config.databasePath)
  logger.info({ databasePath: config.databasePath }, 'SQLite initialized')
  const websocketGateway = new FastifyWebSocketGateway(logger)
  const dependencies = createDependencies(database, logger, websocketGateway, new RealAdbClient())
  const app = await createServer(dependencies)

  try {
    await app.listen({ host: config.host, port: config.port })
  } catch (error) {
    database.close()
    throw error
  }

  let closed = false
  return {
    app, config, logger,
    close: async () => {
      if (closed) return
      closed = true
      logger.info('EventDeck server shutting down')
      await dependencies.liveStreamService.close()
      websocketGateway.close()
      await app.close()
      database.close()
      logger.info('EventDeck server stopped')
    },
  }
}
