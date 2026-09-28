import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createTestServer } from '../helpers.js'

describe('HTTP server foundation', () => {
  let app: FastifyInstance | undefined
  afterEach(async () => { await app?.close() })

  it('creates a testable server without binding a port and serves health', async () => {
    ;({ app } = await createTestServer())
    expect(app.server.listening).toBe(false)
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
    expect(app.server.listening).toBe(false)
  })

  it('reports server, database, and version status', async () => {
    ;({ app } = await createTestServer())
    const response = await app.inject({ method: 'GET', url: '/api/status' })
    expect(response.json()).toEqual({ server: 'connected', database: 'connected', version: 'test' })
  })
})
