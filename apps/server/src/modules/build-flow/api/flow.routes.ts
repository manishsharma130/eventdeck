import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDependencies } from '../../../server/server.types.js'

const flowSchema = z.object({ name: z.string(), eventDefinitionIds: z.array(z.string()) })
const idParams = z.object({ id: z.string() })
const idsSchema = z.object({ ids: z.array(z.string()).max(5000) })

export async function flowRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  const service = dependencies.flowService
  app.get('/api/flows', async (request) => service.list(z.object({ search: z.string().optional() }).parse(request.query).search))
  app.delete('/api/flows', async (request) => dependencies.flowExecutionService.deleteWhenIdle(() => service.deleteMany(idsSchema.parse(request.body).ids)))
  app.get('/api/flows/:id', async (request) => service.get(idParams.parse(request.params).id))
  app.post('/api/flows', async (request, reply) => reply.status(201).send(service.create(flowSchema.parse(request.body))))
  app.put('/api/flows/:id', async (request) => service.update(idParams.parse(request.params).id, flowSchema.parse(request.body)))
  app.delete('/api/flows/:id', async (request) => dependencies.flowExecutionService.deleteWhenIdle(() => service.delete(idParams.parse(request.params).id)))
}
