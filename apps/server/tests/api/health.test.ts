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

  it('allows the GitHub Pages application to access the local API', async () => {
    ;({ app } = await createTestServer())
    const origin = 'https://manishsharma130.github.io'
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin } })
    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe(origin)

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/status',
      headers: { origin, 'access-control-request-method': 'GET' },
    })
    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe(origin)
    expect(preflight.headers['access-control-allow-methods']).toContain('GET')
  })

  it('does not grant API access to unrelated websites', async () => {
    ;({ app } = await createTestServer())
    const response = await app.inject({
      method: 'GET', url: '/health', headers: { origin: 'https://untrusted.example' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
