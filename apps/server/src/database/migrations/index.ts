import type { Migration } from '../migration-runner.js'
import { initialDomainMigration } from './0001-domain.js'
import { storageOperationsMigration } from './0002-storage-operations.js'

export const migrations: readonly Migration[] = [initialDomainMigration, storageOperationsMigration]
