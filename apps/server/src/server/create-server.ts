import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import { registerErrorHandler } from '../api/errors/error-handler.js'
import { registerRoutes } from '../api/routes/index.js'
import type { AppDependencies } from './server.types.js'

export const allowedWebOrigins = new Set([
  'https://manishsharma130.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

export async function createServer(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ loggerInstance: dependencies.logger })
  registerErrorHandler(app)
  await app.register(cors, {
    origin: [...allowedWebOrigins],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type'],
  })
  await app.register(websocket, {
    options: {
      verifyClient: ({ origin }, next) => next(!origin || allowedWebOrigins.has(origin), 403, 'Origin not allowed'),
    },
  })
  await registerRoutes(app, dependencies)
  app.get('/ws', { websocket: true }, (socket) => {
    dependencies.websocketGateway.addClient(socket)
  })
  return app
}
