import { homedir } from 'node:os'
import { join } from 'node:path'
import { configSchema, type AppConfig } from './config.schema.js'

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse({
    host: environment.EVENTDECK_HOST,
    port: environment.EVENTDECK_PORT,
    databasePath: environment.EVENTDECK_DB_PATH ?? join(homedir(), '.eventdeck', 'eventdeck.db'),
    logLevel: environment.EVENTDECK_LOG_LEVEL,
  })
}
