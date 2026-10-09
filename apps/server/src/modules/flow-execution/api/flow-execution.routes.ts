import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDependencies } from '../../../server/server.types.js'
import { AppError } from '../../../shared/errors/app-error.js'

export async function flowExecutionRoutes(app: FastifyInstance, dependencies: AppDependencies): Promise<void> {
  app.get('/api/flow-execution', async () => dependencies.flowSelectionService.getSelected())
  app.put('/api/flow-execution/selected-flows', async (request) => {
    if (dependencies.flowExecutionService.getState().active) throw new AppError('VALIDATION_ACTIVE_SELECTION_LOCKED', 'Stop validation before changing selected flows.', 409)
    return dependencies.flowSelectionService.replace(z.object({ flowIds: z.array(z.string()) }).parse(request.body).flowIds)
  })
  app.get('/api/flow-execution/status', async () => ({
    ...dependencies.flowExecutionService.getState(),
    completion: dependencies.flowExecutionService.getLastCompletion(),
  }))
  app.post('/api/flow-execution/reset', async () => dependencies.flowExecutionService.reset())
  app.post('/api/flow-execution/validate', async (request) => {
    const input = z.object({ recordedSessionId: z.string().optional() }).parse(request.body ?? {})
    const recording = input.recordedSessionId ? dependencies.liveStreamService.getRecording(input.recordedSessionId) : null
    if (recording?.status === 'RECORDING') throw new AppError('RECORDING_NOT_COMPLETED', 'Stop the recording before using it for flow validation.', 409)
    const started = dependencies.flowExecutionService.start()
    if (!recording) return started
    for (const recorded of recording.events) {
      dependencies.flowExecutionService.handleEvent(recorded.event)
      if (!dependencies.flowExecutionService.getState().active) return dependencies.flowExecutionService.getLastCompletion()
    }
    return dependencies.flowExecutionService.stop('SOURCE_COMPLETED')
  })
  app.post('/api/flow-execution/stop', async (request) => dependencies.flowExecutionService.stop(
    z.object({ reason: z.enum(['USER_STOPPED', 'SOURCE_COMPLETED', 'EXECUTION_ERROR']).default('USER_STOPPED') }).parse(request.body ?? {}).reason,
  ))
}
