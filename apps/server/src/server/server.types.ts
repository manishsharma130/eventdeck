import type { Database } from '../database/database.types.js'
import type { AppLogger } from '../logging/logger.js'
import type { FastifyWebSocketGateway } from '../websocket/websocket.gateway.js'

export type AppDependencies = {
  database: Database
  logger: AppLogger
  websocketGateway: FastifyWebSocketGateway
  version: string
}
