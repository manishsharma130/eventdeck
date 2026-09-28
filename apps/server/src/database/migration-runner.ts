import type BetterSqlite3 from 'better-sqlite3'

export type Migration = { version: number; name: string; up(database: BetterSqlite3.Database): void }

export function runMigrations(database: BetterSqlite3.Database, migrations: readonly Migration[]): void {
  database.exec(`CREATE TABLE IF NOT EXISTS _eventdeck_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)
  const applied = new Set(database.prepare('SELECT version FROM _eventdeck_migrations').all().map(
    (row) => (row as { version: number }).version,
  ))
  const apply = database.transaction((migration: Migration) => {
    migration.up(database)
    database.prepare('INSERT INTO _eventdeck_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(migration.version, migration.name, new Date().toISOString())
  })
  for (const migration of [...migrations].sort((left, right) => left.version - right.version)) {
    if (!applied.has(migration.version)) apply(migration)
  }
}
