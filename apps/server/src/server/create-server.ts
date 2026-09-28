import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import { registerErrorHandler } from '../api/errors/error-handler.js'
import { registerRoutes } from '../api/routes/index.js'
import type { AppDependencies } from './server.types.js'

export async function createServer(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ loggerInstance: dependencies.logger })
  registerErrorHandler(app)
  await app.register(websocket)
  await registerRoutes(app, dependencies)
  app.get('/ws', { websocket: true }, (socket) => {
    dependencies.websocketGateway.addClient(socket)
  })
  return app
}
