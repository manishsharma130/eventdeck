import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request as httpRequest } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import { SqliteDatabase } from '../../src/database/sqlite.database.js'
import { calculateStorageUsage } from '../../src/modules/storage/storage-usage.js'
import { STORAGE_MODULES } from '../../src/modules/storage/storage.service.js'
import { createTestServer } from '../helpers.js'

const cleanups: Array<() => void> = []
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()) })
function database() {
  const directory = mkdtempSync(join(tmpdir(), 'eventdeck-usage-'))
  const db = new SqliteDatabase(join(directory, 'data.sqlite'))
  cleanups.push(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })
  db.access(connection => connection.prepare('INSERT INTO recorded_sessions VALUES (?, ?, ?, ?, ?, ?, ?)').run('session', 'Recorded session', 'device', 1, 2, 'COMPLETED', 0))
  return db
}

it('calculates file-backed usage without blocking the event loop and keeps total consistent', async () => {
  const calculation = calculateStorageUsage(database(), STORAGE_MODULES, new AbortController().signal)
  const first = await Promise.race([calculation.then(() => 'calculated'), new Promise(resolve => setImmediate(() => resolve('event-loop')))])
  expect(first).toBe('event-loop')
  const result = await calculation
  expect(result.modules[0].bytes).toBeGreaterThan(0)
  expect(result.totalBytes).toBe(result.modules.reduce((sum, module) => sum + module.bytes, 0))
})

it('aborts the calculation process in flight and supports a fresh request afterward', async () => {
  const db = database()
  const controller = new AbortController()
  const calculation = calculateStorageUsage(db, STORAGE_MODULES, controller.signal)
  const rejected = expect(calculation).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  expect((await calculateStorageUsage(db, STORAGE_MODULES, new AbortController().signal)).totalBytes).toBeGreaterThan(0)
  expect(() => calculateStorageUsage(db, STORAGE_MODULES, controller.signal)).toThrow()
})

it('cancels server-side size work when the HTTP client disconnects', async () => {
  const { app, dependencies } = await createTestServer()
  let started!: () => void
  let cancelled!: () => void
  const start = new Promise<void>(resolve => { started = resolve })
  const cancellation = new Promise<void>(resolve => { cancelled = resolve })
  vi.spyOn(dependencies.storageService, 'getUsage').mockImplementation(signal => new Promise((_resolve, reject) => {
    signal!.addEventListener('abort', () => { cancelled(); reject(new Error('cancelled')) }, { once: true })
    started()
  }))
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const request = httpRequest(`${address}/api/storage`)
    request.on('error', () => undefined)
    request.end()
    await start
    request.destroy()
    await cancellation
  } finally { await app.close() }
})
