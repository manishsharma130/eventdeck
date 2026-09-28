import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../../shared/errors/app-error.js'

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
      })
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.issues },
      })
    }
    app.log.error({ err: error }, 'Unexpected request error')
    return reply.status(500).send({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } })
  })
}
