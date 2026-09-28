import type { FastifyInstance } from 'fastify'
import type { AppDependencies } from '../../server/server.types.js'
import { healthRoutes } from './health.routes.js'

export async function registerRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  await healthRoutes(app, dependencies)
}
