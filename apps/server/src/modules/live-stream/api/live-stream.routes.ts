import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDependencies } from '../../../server/server.types.js'

const idParams = z.object({ id: z.string() })

export async function liveStreamRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  const service = dependencies.liveStreamService
  app.get('/api/settings/connectors', async () => service.getConnectorSettings())
  app.put('/api/settings/connectors', async (request) => service.updateConnectorSettings(z.object({
    google_analytics: z.boolean(), branch: z.boolean(), moengage: z.boolean(),
  }).strict().parse(request.body)))
  app.get('/api/devices', async () => service.listDevices())
  app.get('/api/live-stream/state', async () => service.getState())
  app.put('/api/live-stream/device', async (request) => service.selectDevice(z.object({ deviceId: z.string() }).parse(request.body).deviceId))
  app.post('/api/live-stream/play', async () => service.play())
  app.post('/api/live-stream/pause', async () => service.pause())
  app.post('/api/live-stream/stop', async () => service.stop())
  app.post('/api/live-stream/recording/start', async (request, reply) => reply.status(201).send(await service.startRecording(z.object({ name: z.string() }).parse(request.body).name)))
  app.post('/api/live-stream/recording/stop', async (request) => service.stopRecording(z.object({ name: z.string().optional() }).parse(request.body ?? {}).name))
  app.delete('/api/recorded-sessions', async (request) => service.deleteRecordings(z.object({ ids: z.array(z.string().min(1)).min(1) }).parse(request.body).ids))
  app.delete('/api/recorded-sessions/:id', async (request) => service.deleteRecordings([idParams.parse(request.params).id]))
  app.get('/api/recorded-sessions', async () => service.listRecordings())
  app.get('/api/recorded-sessions/:id', async (request) => service.getRecording(idParams.parse(request.params).id))
}
