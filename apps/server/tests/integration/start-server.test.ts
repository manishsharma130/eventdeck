import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startServer } from '../../src/server/start-server.js'

describe('production server lifecycle', () => {
  const directories: string[] = []
  afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

  it('starts with configured dependencies and shuts down cleanly', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'eventdeck-runtime-'))
    directories.push(directory)
    const databasePath = join(directory, 'eventdeck.db')
    const runtime = await startServer({
      EVENTDECK_HOST: '127.0.0.1',
      EVENTDECK_PORT: '0',
      EVENTDECK_DB_PATH: databasePath,
      EVENTDECK_LOG_LEVEL: 'silent',
    })
    expect(runtime.app.server.listening).toBe(true)
    expect(existsSync(databasePath)).toBe(true)
    await runtime.close()
    expect(runtime.app.server.listening).toBe(false)
  })
})
