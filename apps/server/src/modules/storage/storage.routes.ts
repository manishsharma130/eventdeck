import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDependencies } from '../../server/server.types.js'

export async function storageRoutes(app: FastifyInstance, dependencies: AppDependencies) {
  app.addHook('onClose', async () => dependencies.storageService.cancelCalculations())
  app.get('/api/storage', async (request, reply) => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    request.raw.once('aborted', abort)
    reply.raw.once('close', abort)
    try { return await dependencies.storageService.getUsage(controller.signal) }
    catch (error) {
      if (controller.signal.aborted) { reply.hijack(); return }
      throw error
    } finally {
      request.raw.off('aborted', abort)
      reply.raw.off('close', abort)
    }
  })
  app.get('/api/storage/status', async () => dependencies.storageService.getStatus())
  app.post('/api/storage/clear', async (request, reply) => {
    const { operationId, target } = z.object({
      operationId: z.string().uuid(),
      target: z.enum(['recordings', 'rules', 'build', 'execution', 'all']),
      confirmed: z.literal(true),
    }).strict().parse(request.body)
    return reply.status(202).send(dependencies.storageService.startClear(operationId, target))
  })
}
