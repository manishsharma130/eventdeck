import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SqliteDatabase } from '../../src/database/sqlite.database.js'

describe('SQLite foundation', () => {
  const directories: string[] = []
  afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

  it('initializes configured pragmas and only migration metadata', () => {
    const directory = mkdtempSync(join(tmpdir(), 'eventdeck-test-'))
    directories.push(directory)
    const database = new SqliteDatabase(join(directory, 'test.db'))
    expect(database.isHealthy()).toBe(true)
    expect(database.queryValue<number>('PRAGMA foreign_keys')).toBe(1)
    expect(database.queryValue<string>('PRAGMA journal_mode')).toBe('wal')
    expect(database.queryValue<number>('PRAGMA busy_timeout')).toBe(5000)
    expect(database.queryValue<number>("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).toBe(9)
    expect(database.queryValue<number>("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_eventdeck_migrations'")).toBe(1)
    expect(database.queryValue<number>('SELECT COUNT(*) FROM _eventdeck_migrations')).toBe(2)
    database.close()
  })
})
