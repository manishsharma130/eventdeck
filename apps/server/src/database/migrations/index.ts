import type { Migration } from '../migration-runner.js'
import { initialDomainMigration } from './0001-domain.js'

export const migrations: readonly Migration[] = [initialDomainMigration]
