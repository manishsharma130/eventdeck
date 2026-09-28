import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import type { Database } from './database.types.js'
import { migrations } from './migrations/index.js'
import { runMigrations } from './migration-runner.js'

export class SqliteDatabase implements Database {
  private readonly connection: BetterSqlite3.Database

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.connection = new BetterSqlite3(path)
    this.connection.pragma('foreign_keys = ON')
    this.connection.pragma('journal_mode = WAL')
    this.connection.pragma('busy_timeout = 5000')
    runMigrations(this.connection, migrations)
  }

  transaction<T>(operation: () => T): T { return this.connection.transaction(operation)() }
  isHealthy(): boolean {
    return (this.connection.prepare('SELECT 1 AS value').get() as { value: number }).value === 1
  }
  /** Intended for infrastructure diagnostics and integration tests only. */
  queryValue<T>(sql: string): T { return this.connection.prepare(sql).pluck().get() as T }
  close(): void { if (this.connection.open) this.connection.close() }
}
