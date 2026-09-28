import type { FastifyBaseLogger } from 'fastify'
import pino from 'pino'

export function createLogger(level: string): FastifyBaseLogger {
  return pino({ level })
}

export type AppLogger = FastifyBaseLogger
