import { expect, it } from 'vitest'
import { createTestServer } from '../helpers.js'

it('exposes defaults, updates optional settings, and rejects disabling the core connector', async () => {
  const { app } = await createTestServer()
  try {
    const defaults = await app.inject({ method: 'GET', url: '/api/settings/connectors' })
    expect(defaults.json().settings).toEqual({ google_analytics: true, branch: true, moengage: true })
    const settings = { google_analytics: false, branch: false, moengage: false }
    const result = await app.inject({ method: 'PUT', url: '/api/settings/connectors', payload: settings })
    expect(result.statusCode).toBe(200)
    expect(result.json().settings).toEqual(settings)
    const invalid = await app.inject({ method: 'PUT', url: '/api/settings/connectors', payload: { ...settings, analytics_event: false } })
    expect(invalid.statusCode).toBe(400)
  } finally { await app.close() }
})
