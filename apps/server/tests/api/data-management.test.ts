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
    const hydrated = await app.inject({ method: 'GET', url: '/api/flow-execution/status' })
    expect(hydrated.json()).toMatchObject({ active: false, completion: { flows: [{ status: 'PARTIAL' }] } })
    await app.inject({ method: 'POST', url: '/api/flow-execution/reset', payload: {} })
    expect((await app.inject({ method: 'GET', url: '/api/flow-execution/status' })).json()).toMatchObject({ active: false, completion: null })
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
    expect(remainingFlow.statusCode).toBe(404)
    const batchDelete = await app.inject({ method: 'DELETE', url: '/api/flows', payload: { ids: [first.json<{ id: string }>().id, second.json<{ id: string }>().id] } })
    expect(batchDelete.json()).toEqual({ deleted: 0 })
  })

  it('validates same-name definitions once across flows and keeps an immutable active snapshot', async () => {
    const home = (await app.inject({ method: 'POST', url: '/api/event-rules', payload: {
      name: 'Home Open', eventValue: 'screen_open', rules: [{ paramKey: 'screen', matchType: 'exact', expectedValue: 'home' }],
    } })).json<{ id: string }>()
    const search = (await app.inject({ method: 'POST', url: '/api/event-rules', payload: {
      name: 'Search Open', eventValue: 'screen_open', rules: [{ paramKey: 'screen', matchType: 'exact', expectedValue: 'search' }],
    } })).json<{ id: string }>()
    const first = (await app.inject({ method: 'POST', url: '/api/flows', payload: { name: 'Discovery', eventDefinitionIds: [home.id, search.id] } })).json<{ id: string }>()
    const second = (await app.inject({ method: 'POST', url: '/api/flows', payload: { name: 'Home Only', eventDefinitionIds: [home.id] } })).json<{ id: string }>()
    await app.inject({ method: 'PUT', url: '/api/flow-execution/selected-flows', payload: { flowIds: [first.id, second.id] } })
    await app.inject({ method: 'POST', url: '/api/flow-execution/validate', payload: {} })

    const locked = await app.inject({ method: 'PUT', url: '/api/flow-execution/selected-flows', payload: { flowIds: [second.id] } })
    expect(locked.statusCode).toBe(409)
    expect(locked.json().error.code).toBe('VALIDATION_ACTIVE_SELECTION_LOCKED')

    const firstHome = dependencies.flowExecutionService.handleEvent({ eventName: 'screen_open', eventParams: { screen: 'home' } })
    expect(firstHome).toHaveLength(1)
    expect(firstHome[0].affectedFlows).toHaveLength(2)
    expect(dependencies.flowExecutionService.handleEvent({ eventName: 'screen_open', eventParams: { screen: 'home' } })).toEqual([])

    await app.inject({ method: 'PUT', url: `/api/event-rules/${search.id}`, payload: {
      name: 'Search Open', eventValue: 'screen_open', rules: [{ paramKey: 'screen', matchType: 'exact', expectedValue: 'profile' }],
    } })
    const snapshotMatch = dependencies.flowExecutionService.handleEvent({ eventName: 'screen_open', eventParams: { screen: 'search' } })
    expect(snapshotMatch).toHaveLength(1)
    expect(snapshotMatch[0].eventDefinitionId).toBe(search.id)

    const completed = await app.inject({ method: 'POST', url: '/api/flow-execution/stop', payload: {} })
    expect(completed.json().flows).toEqual([
      expect.objectContaining({ flowIndex: 0, status: 'PASSED', passedEvents: 2, failedEvents: 0 }),
      expect.objectContaining({ flowIndex: 1, status: 'PASSED', passedEvents: 1, failedEvents: 0 }),
    ])
  })

  it.each([false, true])('cascades event deletion through flows and selected flows (bulk: %s)', async (bulk) => {
    const removed = dependencies.eventRuleService.create({ name: 'Remove', eventValue: 'remove', rules: [] })
    const retained = dependencies.eventRuleService.create({ name: 'Keep', eventValue: 'keep', rules: [] })
    const mixed = dependencies.flowService.create({ name: 'Mixed', eventDefinitionIds: [removed.id, retained.id] })
    const empty = dependencies.flowService.create({ name: 'Becomes empty', eventDefinitionIds: [removed.id] })
    const untouched = dependencies.flowService.create({ name: 'Untouched', eventDefinitionIds: [retained.id] })
    await app.inject({ method: 'PUT', url: '/api/flow-execution/selected-flows', payload: { flowIds: [empty.id, mixed.id, untouched.id] } })
    dependencies.flowExecutionService.start()
    dependencies.flowExecutionService.stop()
    const response = await app.inject({ method: 'DELETE', url: bulk ? '/api/event-rules' : `/api/event-rules/${removed.id}`, ...(bulk ? { payload: { ids: [removed.id] } } : {}) })
    expect(response.statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: `/api/flows/${empty.id}` })).statusCode).toBe(404)
    expect(dependencies.flowService.get(mixed.id).events).toEqual([expect.objectContaining({ eventDefinitionId: retained.id, position: 0 })])
    const selected = dependencies.flowSelectionService.getSelected()
    expect(selected.map((flow) => flow.flowId)).toEqual([mixed.id, untouched.id])
    expect(selected.flatMap((flow) => flow.events).every((event) => event.eventDefinitionId === retained.id)).toBe(true)
    expect(dependencies.flowExecutionService.getState()).toEqual({ active: false, flows: [] })
    expect(dependencies.flowExecutionService.getLastCompletion()).toBeNull()
    expect(dependencies.flowExecutionService.start().flows).toHaveLength(2)
  })

  it.each([
    ['event-rules', false], ['event-rules', true], ['flows', false], ['flows', true],
  ] as const)('blocks %s deletion during validation (bulk: %s) and permits it after stopping', async (resource, bulk) => {
    const event = dependencies.eventRuleService.create({ name: 'Open', eventValue: 'open', rules: [] })
    const flow = dependencies.flowService.create({ name: 'Open flow', eventDefinitionIds: [event.id] })
    await app.inject({ method: 'PUT', url: '/api/flow-execution/selected-flows', payload: { flowIds: [flow.id] } })
    dependencies.flowExecutionService.start()
    const id = resource === 'event-rules' ? event.id : flow.id
    const request = { method: 'DELETE' as const, url: `/api/${resource}${bulk ? '' : `/${id}`}`, ...(bulk ? { payload: { ids: [id] } } : {}) }
    const response = await app.inject(request)
    expect(response.statusCode).toBe(409)
    expect(response.json().error).toMatchObject({ code: 'VALIDATION_ACTIVE_DELETE_BLOCKED', message: 'Validation is currently running, so the delete operation cannot proceed. Stop validation first and try again.' })
    expect(dependencies.eventRuleService.get(event.id).id).toBe(event.id)
    expect(dependencies.flowService.get(flow.id).events).toHaveLength(1)
    expect(dependencies.flowSelectionService.getSelected()).toHaveLength(1)
    expect(dependencies.flowExecutionService.getState().active).toBe(true)
    dependencies.flowExecutionService.stop()
    expect((await app.inject(request)).statusCode).toBe(200)
    expect(dependencies.flowSelectionService.getSelected()).toEqual([])
    expect(dependencies.flowExecutionService.getState()).toEqual({ active: false, flows: [] })
  })

})
