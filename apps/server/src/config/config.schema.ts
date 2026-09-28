import { z } from 'zod'

export const configSchema = z.object({
  host: z.string().min(1).default('127.0.0.1'),
  port: z.coerce.number().int().min(0).max(65_535).default(4732),
  databasePath: z.string().min(1),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type AppConfig = z.infer<typeof configSchema>
