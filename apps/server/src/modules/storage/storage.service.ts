import { calculateStorageUsage } from './storage-usage.js'
import type { SqliteDatabase } from '../../database/sqlite.database.js'
import type { RuntimeEventRuleIndex } from '../event-rules/application/runtime-event-rule-index.js'
import type { FlowExecutionService } from '../flow-execution/application/flow-execution.service.js'
import type { LiveStreamService } from '../live-stream/application/live-stream.service.js'
import type { WebSocketGateway } from '../../websocket/websocket.types.js'
import { AppError } from '../../shared/errors/app-error.js'

export const STORAGE_MODULES = [
  { id: 'recordings', name: 'Recording Session', tables: ['recorded_sessions', 'recorded_session_events'], clears: ['recordings'] },
  { id: 'rules', name: 'Event Rules', tables: ['event_definitions', 'event_rule_conditions'], clears: ['rules', 'build', 'execution'] },
  { id: 'build', name: 'Build Flow', tables: ['flows', 'flow_events'], clears: ['build', 'execution'] },
  { id: 'execution', name: 'Flow Execution', tables: ['selected_flows'], clears: ['execution'] },
] as const
export type StorageModuleId = typeof STORAGE_MODULES[number]['id']
export type StorageTarget = StorageModuleId | 'all'
export type StorageOperationStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'
export type StorageOperation = {
  id: string; target: StorageTarget; affected: readonly StorageModuleId[]; status: StorageOperationStatus
  error: string | null; startedAt: number; completedAt: number | null
}
type OperationRow = { id: string; target: StorageTarget; affected_json: string; status: StorageOperationStatus; error: string | null; started_at: number; completed_at: number | null }

export class StorageService {
  private readonly calculations = new Set<AbortController>()
  private activeOperation: Promise<void> | null = null
  private closing = false

  constructor(
    private readonly database: SqliteDatabase,
    private readonly rules: RuntimeEventRuleIndex,
    private readonly execution: FlowExecutionService,
    private readonly live: LiveStreamService,
    private readonly websocket: WebSocketGateway,
    private readonly now: () => number = Date.now,
  ) {
    const stoppedAt = this.now()
    this.database.access(db => db.prepare("UPDATE storage_operations SET status = 'INTERRUPTED', error = ?, completed_at = ? WHERE status = 'RUNNING'")
      .run('The server stopped before this operation reported completion. Any unfinished SQLite transaction was rolled back; refresh storage sizes to verify the final state.', stoppedAt))
  }

  async getUsage(signal?: AbortSignal) {
    const controller = new AbortController()
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    this.calculations.add(controller)
    try { return await calculateStorageUsage(this.database, STORAGE_MODULES, combined) }
    finally { this.calculations.delete(controller) }
  }

  getStatus() {
    const live = this.live.getState()
    const blockers: string[] = []
    if (live.streamState === 'PLAYING') blockers.push('LIVE_STREAM_PLAYING')
    if (live.isRecording) blockers.push('RECORDING_ACTIVE')
    if (this.execution.getState().active) blockers.push('VALIDATION_ACTIVE')
    const operation = this.latestOperation()
    if (operation?.status === 'RUNNING') blockers.push('DELETION_ACTIVE')
    return { deletionAllowed: blockers.length === 0, blockers, operation }
  }

  startClear(id: string, target: StorageTarget): StorageOperation {
    const existing = this.findOperation(id)
    if (existing) {
      if (existing.target !== target) throw new AppError('STORAGE_OPERATION_ID_CONFLICT', 'This operation ID was already used for another storage target.', 409)
      return existing
    }
    if (this.closing) throw new AppError('SERVER_SHUTTING_DOWN', 'The server is shutting down. Try again after it restarts.', 503)
    const status = this.getStatus()
    if (!status.deletionAllowed) throw new AppError('STORAGE_CLEAR_BLOCKED', this.blockerMessage(status.blockers), 409, { blockers: status.blockers })
    const affected = this.affectedFor(target)
    const operation: StorageOperation = { id, target, affected, status: 'RUNNING', error: null, startedAt: this.now(), completedAt: null }
    try {
      this.database.access(db => db.prepare('INSERT INTO storage_operations (id, target, affected_json, status, started_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, target, JSON.stringify(affected), operation.status, operation.startedAt))
    } catch {
      throw new AppError('STORAGE_CLEAR_IN_PROGRESS', 'Another storage deletion is already running.', 409)
    }
    this.websocket.broadcast('storage.operation_changed', operation)
    this.activeOperation = new Promise<void>(resolve => setImmediate(() => {
      try { this.runClear(operation) } finally { this.activeOperation = null; resolve() }
    }))
    return operation
  }

  cancelCalculations(): void { for (const controller of this.calculations) controller.abort() }

  async close(): Promise<void> {
    this.closing = true
    this.cancelCalculations()
    await this.activeOperation
  }

  private runClear(operation: StorageOperation): void {
    try {
      const remove = () => this.database.transaction(() => this.database.access(db => {
        for (const module of [...STORAGE_MODULES].reverse()) {
          if (!operation.affected.includes(module.id)) continue
          for (const table of [...module.tables].reverse()) db.prepare(`DELETE FROM ${table}`).run()
        }
      }))
      if (operation.affected.includes('execution')) this.execution.deleteWhenIdle(remove)
      else remove()
      if (operation.affected.includes('rules')) this.rules.rebuild([])
      const completed = this.finishOperation(operation, 'COMPLETED', null)
      this.websocket.broadcast('storage.operation_changed', completed)
      this.websocket.broadcast('storage.cleared', { operationId: operation.id, affected: operation.affected })
    } catch (error) {
      const failed = this.finishOperation(operation, 'FAILED', error instanceof Error ? error.message : String(error))
      this.websocket.broadcast('storage.operation_changed', failed)
    }
  }

  private finishOperation(operation: StorageOperation, status: 'COMPLETED' | 'FAILED', error: string | null): StorageOperation {
    const completedAt = this.now()
    this.database.access(db => db.prepare('UPDATE storage_operations SET status = ?, error = ?, completed_at = ? WHERE id = ?')
      .run(status, error, completedAt, operation.id))
    return { ...operation, status, error, completedAt }
  }

  private affectedFor(target: StorageTarget): readonly StorageModuleId[] {
    return target === 'all' ? STORAGE_MODULES.map(module => module.id) : STORAGE_MODULES.find(module => module.id === target)!.clears
  }
  private findOperation(id: string): StorageOperation | null {
    return this.fromRow(this.database.access(db => db.prepare('SELECT * FROM storage_operations WHERE id = ?').get(id) as OperationRow | undefined))
  }
  private latestOperation(): StorageOperation | null {
    return this.fromRow(this.database.access(db => db.prepare('SELECT * FROM storage_operations ORDER BY started_at DESC, rowid DESC LIMIT 1').get() as OperationRow | undefined))
  }
  private fromRow(row?: OperationRow): StorageOperation | null {
    return row ? { id: row.id, target: row.target, affected: JSON.parse(row.affected_json) as StorageModuleId[], status: row.status, error: row.error, startedAt: row.started_at, completedAt: row.completed_at } : null
  }
  private blockerMessage(blockers: string[]): string {
    if (blockers.includes('DELETION_ACTIVE')) return 'Another storage deletion is already running.'
    if (blockers.includes('RECORDING_ACTIVE')) return 'Stop and save the active recording before clearing storage.'
    if (blockers.includes('VALIDATION_ACTIVE')) return 'Stop the active flow validation before clearing storage.'
    return 'Stop Live Stream before clearing storage.'
  }
}
