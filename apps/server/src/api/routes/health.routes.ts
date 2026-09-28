import type { FastifyInstance } from 'fastify'
import type { AppDependencies } from '../../server/server.types.js'

export async function healthRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/api/status', async () => ({
    server: 'connected',
    database: dependencies.database.isHealthy() ? 'connected' : 'disconnected',
    version: dependencies.version,
  }))
}
