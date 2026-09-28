import type { FastifyInstance } from 'fastify'
import type { AppDependencies } from '../../server/server.types.js'
import { healthRoutes } from './health.routes.js'
import { eventRuleRoutes } from '../../modules/event-rules/api/event-rule.routes.js'
import { flowRoutes } from '../../modules/build-flow/api/flow.routes.js'
import { flowExecutionRoutes } from '../../modules/flow-execution/api/flow-execution.routes.js'
import { liveStreamRoutes } from '../../modules/live-stream/api/live-stream.routes.js'

export async function registerRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  await healthRoutes(app, dependencies)
  await liveStreamRoutes(app, dependencies)
  await eventRuleRoutes(app, dependencies)
  await flowRoutes(app, dependencies)
  await flowExecutionRoutes(app, dependencies)
}
