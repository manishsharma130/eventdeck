import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDependencies } from '../../../server/server.types.js'
import { matchTypes } from '../domain/event-rule.types.js'

const conditionSchema = z.object({
  paramKey: z.string(),
  matchType: z.enum(matchTypes),
  expectedValue: z.string().optional(),
})
const definitionSchema = z.object({ name: z.string().default(''), eventValue: z.string(), rules: z.array(conditionSchema).default([]) })
const idsSchema = z.object({ ids: z.array(z.string()).max(5000) })

export async function eventRuleRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  const service = dependencies.eventRuleService
  app.get('/api/event-rules', async () => service.list())
  app.post('/api/event-rules/usage', async (request) => service.usageMany(idsSchema.parse(request.body).ids))
  app.delete('/api/event-rules', async (request) => dependencies.flowExecutionService.deleteWhenIdle(() => service.deleteMany(idsSchema.parse(request.body).ids)))
  app.get('/api/event-rules/:id/usage', async (request) => service.usage(z.object({ id: z.string() }).parse(request.params).id))
  app.get('/api/event-rules/:id', async (request) => service.get(z.object({ id: z.string() }).parse(request.params).id))
  app.post('/api/event-rules', async (request, reply) => reply.status(201).send(service.create(definitionSchema.parse(request.body))))
  app.put('/api/event-rules/:id', async (request) => service.update(z.object({ id: z.string() }).parse(request.params).id, definitionSchema.parse(request.body)))
  app.delete('/api/event-rules/:id', async (request) => dependencies.flowExecutionService.deleteWhenIdle(() => service.delete(z.object({ id: z.string() }).parse(request.params).id)))
}
