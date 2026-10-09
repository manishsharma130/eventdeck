import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { AppDependencies } from '../../src/server/server.types.js'
import type { SqliteDatabase } from '../../src/database/sqlite.database.js'
import { createTestServer } from '../helpers.js'
import { randomUUID } from 'node:crypto'
import { StorageService } from '../../src/modules/storage/storage.service.js'

describe('storage management', () => {
  let app: FastifyInstance
  let deps: AppDependencies
  beforeEach(async () => {
    const server = await createTestServer(); app = server.app; deps = server.dependencies
    const rule = deps.eventRuleService.create({ name: 'Open', eventValue: 'open', rules: [{ paramKey: 'screen', matchType: 'exists' }] })
    const flow = deps.flowService.create({ name: 'Main', eventDefinitionIds: [rule.id] })
    await app.inject({ method: 'PUT', url: '/api/flow-execution/selected-flows', payload: { flowIds: [flow.id] } })
    deps.flowExecutionService.start(); deps.flowExecutionService.stop()
    await deps.liveStreamService.selectDevice('device')
    await deps.liveStreamService.startRecording('Saved')
    deps.liveStreamService.handleMessage(JSON.stringify({ eventName: 'open', eventTag: 'property', eventParams: { screen: '🏠' } }))
    await deps.liveStreamService.stopRecording()
  })
  afterEach(async () => { await app.close() })
  const clear = (target: string, operationId = randomUUID()) => app.inject({ method: 'POST', url: '/api/storage/clear', payload: { operationId, target, confirmed: true } })
  const waitForOperation = async (id: string) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const status = (await app.inject({ method: 'GET', url: '/api/storage/status' })).json()
      if (status.operation?.id === id && status.operation.status !== 'RUNNING') return status.operation
      await new Promise(resolve => setTimeout(resolve, 2))
    }
    throw new Error('Storage operation did not finish.')
  }

  it.each([
    ['recordings', ['recordings']], ['rules', ['rules', 'build', 'execution']],
    ['build', ['build', 'execution']], ['execution', ['execution']],
    ['all', ['recordings', 'rules', 'build', 'execution']],
  ])('clears %s with exactly its dependencies', async (target, affected) => {
    const before = await deps.storageService.getUsage()
    expect(before.modules.every(module => module.bytes > 0)).toBe(true)
    expect(before.totalBytes).toBe(before.modules.reduce((sum, module) => sum + module.bytes, 0))
    const operationId = randomUUID()
    const response = await clear(target as string, operationId)
    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({ id: operationId, status: 'RUNNING', affected })
    expect(await waitForOperation(operationId)).toMatchObject({ status: 'COMPLETED', affected })
    const after = await deps.storageService.getUsage()
    for (const module of after.modules) {
      expect(module.bytes).toBe(affected.includes(module.id) ? 0 : before.modules.find(m => m.id === module.id)!.bytes)
    }
    if (affected.includes('execution')) {
      expect(deps.flowSelectionService.getSelected()).toEqual([])
      expect(deps.flowExecutionService.getLastCompletion()).toBeNull()
      expect(deps.flowExecutionService.getState()).toEqual({ active: false, flows: [] })
    }
    expect(deps.eventRuleIndex.match({ eventName: 'open', eventParams: { screen: 'home' } })).toHaveLength(affected.includes('rules') ? 0 : 1)
    expect((deps.database as SqliteDatabase).access(db => db.pragma('foreign_key_check'))).toEqual([])
    const repeat = await clear(target as string, operationId)
    expect(repeat.statusCode).toBe(202)
    expect(repeat.json()).toMatchObject({ id: operationId, status: 'COMPLETED' })
  })

  it('requires explicit confirmation and validates targets', async () => {
    const before = await deps.storageService.getUsage()
    for (const payload of [{ target: 'all' }, { operationId: randomUUID(), target: 'all', confirmed: false }, { operationId: randomUUID(), target: 'bogus', confirmed: true }]) {
      expect((await app.inject({ method: 'POST', url: '/api/storage/clear', payload })).statusCode).toBe(400)
    }
    expect(await deps.storageService.getUsage()).toEqual(before)
  })

  it('blocks every clear during recording without partially clearing data', async () => {
    await deps.liveStreamService.startRecording('Active')
    const before = await deps.storageService.getUsage()
    expect((await clear('recordings')).statusCode).toBe(409)
    expect((await clear('all')).statusCode).toBe(409)
    expect(await deps.storageService.getUsage()).toEqual(before)
    expect((await clear('rules')).statusCode).toBe(409)
    expect(deps.liveStreamService.getState().isRecording).toBe(true)
    await deps.liveStreamService.stopRecording()
  })

  it('blocks every clear during validation', async () => {
    deps.flowExecutionService.start()
    const before = await deps.storageService.getUsage()
    for (const target of ['recordings', 'rules', 'build', 'execution', 'all']) expect((await clear(target)).statusCode).toBe(409)
    expect(await deps.storageService.getUsage()).toEqual(before)
    expect(deps.flowExecutionService.getState().active).toBe(true)
    deps.flowExecutionService.stop()
    const id = randomUUID()
    expect((await clear('all', id)).statusCode).toBe(202)
    expect(await waitForOperation(id)).toMatchObject({ status: 'COMPLETED' })
  })

  it('blocks every clear while Live Stream is playing', async () => {
    await deps.liveStreamService.play()
    const response = await clear('recordings')
    expect(response.statusCode).toBe(409)
    expect(response.json().error.details.blockers).toContain('LIVE_STREAM_PLAYING')
    await deps.liveStreamService.stop()
  })

  it('rolls back all tables if one delete fails and retains runtime snapshots', async () => {
    const before = await deps.storageService.getUsage()
    const completion = deps.flowExecutionService.getLastCompletion()
    ;(deps.database as SqliteDatabase).access(db => db.exec("CREATE TRIGGER prevent_rule_delete BEFORE DELETE ON event_definitions BEGIN SELECT RAISE(ABORT, 'test failure'); END"))
    const id = randomUUID()
    expect((await clear('all', id)).statusCode).toBe(202)
    expect(await waitForOperation(id)).toMatchObject({ status: 'FAILED', error: 'test failure' })
    expect(await deps.storageService.getUsage()).toEqual(before)
    expect(deps.flowExecutionService.getLastCompletion()).toEqual(completion)
    expect(deps.eventRuleIndex.match({ eventName: 'open', eventParams: { screen: 'home' } })).toHaveLength(1)
  })

  it('marks an operation interrupted when the server starts after an unclean stop', () => {
    const operationId = randomUUID()
    ;(deps.database as SqliteDatabase).access(db => db.prepare(
      'INSERT INTO storage_operations (id, target, affected_json, status, started_at) VALUES (?, ?, ?, ?, ?)',
    ).run(operationId, 'all', JSON.stringify(['recordings', 'rules', 'build', 'execution']), 'RUNNING', 100))
    const restarted = new StorageService(
      deps.database as SqliteDatabase, deps.eventRuleIndex, deps.flowExecutionService,
      deps.liveStreamService, deps.websocketGateway, () => 200,
    )
    expect(restarted.getStatus().operation).toMatchObject({
      id: operationId, status: 'INTERRUPTED', completedAt: 200,
    })
  })
})
