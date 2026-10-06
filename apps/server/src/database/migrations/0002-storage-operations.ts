import type { Migration } from '../migration-runner.js'

export const storageOperationsMigration: Migration = {
  version: 2,
  name: 'storage_operations',
  up(database) {
    database.exec(`
      CREATE TABLE storage_operations (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL CHECK (target IN ('recordings', 'rules', 'build', 'execution', 'all')),
        affected_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'INTERRUPTED')),
        error TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE UNIQUE INDEX idx_storage_operation_running ON storage_operations(status) WHERE status = 'RUNNING';
    `)
  },
}
