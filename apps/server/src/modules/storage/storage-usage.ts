import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import type { SqliteDatabase } from '../../database/sqlite.database.js'
import type { STORAGE_MODULES } from './storage.service.js'

export type StorageUsage = {
  totalBytes: number
  measurement: 'stored_payload_bytes'
  modules: Array<{ id: string; name: string; bytes: number; clears: string[] }>
}

// A separate process lets cancellation interrupt a synchronous native SQLite
// scan immediately. Worker-thread termination can wait for native calls to end.
// All inputs are passed as arguments, never interpolated into executable code.
const usageProgram = `
const Sqlite = require(process.argv[1]);
const source = process.argv[2] === ':memory:' ? require('node:fs').readFileSync(0) : process.argv[2];
const db = new Sqlite(source, { readonly: true, fileMustExist: true });
try {
  db.pragma('query_only = ON');
  const definitions = JSON.parse(process.argv[3]);
  const modules = db.transaction(() => definitions.map(module => {
    let bytes = 0;
    for (const table of module.tables) {
      const columns = db.prepare('PRAGMA table_info(' + table + ')').all();
      const expression = columns.map(column => 'COALESCE(length(CAST("' + column.name + '" AS BLOB)), 0)').join(' + ');
      bytes += db.prepare('SELECT COALESCE(SUM(' + expression + '), 0) FROM ' + table).pluck().get();
    }
    return { id: module.id, name: module.name, bytes, clears: module.clears };
  }))();
  process.stdout.write(JSON.stringify({ totalBytes: modules.reduce((sum, module) => sum + module.bytes, 0), measurement: 'stored_payload_bytes', modules }));
} finally { db.close(); }
`
const sqliteModule = createRequire(import.meta.url).resolve('better-sqlite3')

export function calculateStorageUsage(database: SqliteDatabase, definitions: typeof STORAGE_MODULES, signal: AbortSignal): Promise<StorageUsage> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, ['-e', usageProgram, sqliteModule, database.path, JSON.stringify(definitions)], {
      signal, killSignal: 'SIGKILL', maxBuffer: 64 * 1024,
    }, (error, stdout) => {
      if (error) { reject(error); return }
      try { resolve(JSON.parse(stdout) as StorageUsage) } catch (cause) { reject(cause) }
    })
    // Only isolated in-memory tests need a snapshot. Production opens the file
    // read-only in the child, so the main server never scans/copies its contents.
    child.stdin?.on('error', () => { /* Cancellation may close stdin early. */ })
    child.stdin?.end(database.path === ':memory:' ? database.access(db => db.serialize()) : undefined)
  })
}
