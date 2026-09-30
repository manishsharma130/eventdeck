import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppDependencies } from '../../src/server/server.types.js'
import { createTestServer } from '../helpers.js'

describe('consolidated data management APIs', () => {
  let app: FastifyInstance
  let dependencies: AppDependencies
  beforeEach(async () => { ({ app, dependencies } = await createTestServer()) })
  afterEach(async () => app.close())

  it('creates unique event definitions, ordered flows, and an immutable execution snapshot', async () => {
    const homeResponse = await app.inject({ method: 'POST', url: '/api/event-rules', payload: {
      name: 'Home Open', eventValue: 'app_open', rules: [{ paramKey: 'screen', matchType: 'exact', expectedValue: 'home' }],
    } })
    expect(homeResponse.statusCode).toBe(201)
    const home = homeResponse.json<{ id: string }>()
    const purchase = (await app.inject({ method: 'POST', url: '/api/event-rules', payload: {
      name: 'Premium Purchase', eventValue: 'purchase', rules: [{ paramKey: 'plan', matchType: 'exact', expectedValue: 'premium' }],
    } })).json<{ id: string }>()

    const duplicate = await app.inject({ method: 'POST', url: '/api/event-rules', payload: {
      name: 'Another Home', eventValue: 'app_open', rules: [{ paramKey: 'screen', matchType: 'exact', expectedValue: 'home' }],
    } })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('EVENT_DEFINITION_ALREADY_EXISTS')

    const flowResponse = await app.inject({ method: 'POST', url: '/api/flows', payload: {
      name: 'Conversion', eventDefinitionIds: [home.id, purchase.id],
    } })
    expect(flowResponse.statusCode).toBe(201)
    const flow = flowResponse.json<{ id: string }>()
    await app.inject({ method: 'PUT', url: '/api/flow-execution/selected-flows', payload: { flowIds: [flow.id] } })
    expect((await app.inject({ method: 'POST', url: '/api/flow-execution/validate', payload: {} })).statusCode).toBe(200)

    dependencies.liveStreamService.handleMessage(JSON.stringify({ eventName: 'app_open', eventParams: { screen: 'home' } }))
    const completed = await app.inject({ method: 'POST', url: '/api/flow-execution/stop', payload: {} })
    expect(completed.json().flows[0]).toMatchObject({ totalEvents: 2, passedEvents: 1, failedEvents: 1, status: 'PARTIAL' })
    expect(completed.json().flows[0].events).toEqual([
      expect.objectContaining({ eventDefinitionId: home.id, eventIndex: 0, status: 'PASSED' }),
      expect.objectContaining({ eventDefinitionId: purchase.id, eventIndex: 1, status: 'FAILED' }),
    ])
  })

  it('preserves flow names as the only flow-level uniqueness constraint', async () => {
    const event = (await app.inject({ method: 'POST', url: '/api/event-rules', payload: { name: 'Open', eventValue: 'open', rules: [] } })).json<{ id: string }>()
    const first = await app.inject({ method: 'POST', url: '/api/flows', payload: { name: 'Flow A', eventDefinitionIds: [event.id] } })
    const second = await app.inject({ method: 'POST', url: '/api/flows', payload: { name: 'Flow B', eventDefinitionIds: [event.id] } })
    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    const duplicateName = await app.inject({ method: 'POST', url: '/api/flows', payload: { name: 'flow a', eventDefinitionIds: [event.id] } })
    expect(duplicateName.statusCode).toBe(409)
    expect((await app.inject({ method: 'POST', url: '/api/event-rules/usage', payload: { ids: [event.id] } })).json()).toEqual({ flowCount: 2 })
    expect((await app.inject({ method: 'DELETE', url: '/api/event-rules', payload: { ids: [event.id] } })).json()).toMatchObject({ deleted: 1, affectedFlows: 2 })
    const remainingFlow = await app.inject({ method: 'GET', url: `/api/flows/${first.json<{ id: string }>().id}` })
    expect(remainingFlow.statusCode).toBe(200)
    expect(remainingFlow.json().events).toEqual([])
    const batchDelete = await app.inject({ method: 'DELETE', url: '/api/flows', payload: { ids: [first.json<{ id: string }>().id, second.json<{ id: string }>().id] } })
    expect(batchDelete.json()).toEqual({ deleted: 2 })
  })
})
