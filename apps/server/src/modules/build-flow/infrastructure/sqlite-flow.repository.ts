import type BetterSqlite3 from 'better-sqlite3'
import type { SqliteDatabase } from '../../../database/sqlite.database.js'
import type { FlowRepository } from '../application/flow.repository.js'
import type { Flow, FlowEvent } from '../domain/flow.types.js'

type FlowRow = { id: string; name: string; created_at: number; updated_at: number }
type FlowEventRow = { id: string; flow_id: string; event_definition_id: string; position: number }
type FlowWithEventRow = FlowRow & { event_id: string | null; event_definition_id: string | null; position: number | null }

export class SqliteFlowRepository implements FlowRepository {
  constructor(private readonly database: SqliteDatabase) {}
  create(flow: Flow): Flow {
    return this.database.access((db) => db.transaction(() => {
      db.prepare('INSERT INTO flows (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(flow.id, flow.name, flow.createdAt, flow.updatedAt)
      this.insertEvents(db, flow)
      return flow
    })())
  }
  update(flow: Flow): Flow {
    return this.database.access((db) => db.transaction(() => {
      db.prepare('UPDATE flows SET name = ?, updated_at = ? WHERE id = ?').run(flow.name, flow.updatedAt, flow.id)
      db.prepare('DELETE FROM flow_events WHERE flow_id = ?').run(flow.id)
      this.insertEvents(db, flow)
      return flow
    })())
  }
  delete(id: string): boolean { return this.database.access((db) => db.prepare('DELETE FROM flows WHERE id = ?').run(id).changes > 0) }
  deleteMany(ids: string[]): number {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return 0
    const placeholders = uniqueIds.map(() => '?').join(',')
    return this.database.access((db) => db.prepare(`DELETE FROM flows WHERE id IN (${placeholders})`).run(...uniqueIds).changes)
  }
  findById(id: string): Flow | null {
    return this.database.access((db) => {
      const row = db.prepare('SELECT id, name, created_at, updated_at FROM flows WHERE id = ?').get(id) as FlowRow | undefined
      return row ? this.map(db, row) : null
    })
  }
  findByName(name: string): Flow | null {
    return this.database.access((db) => {
      const row = db.prepare('SELECT id, name, created_at, updated_at FROM flows WHERE name = ? COLLATE NOCASE').get(name) as FlowRow | undefined
      return row ? this.map(db, row) : null
    })
  }
  list(search = ''): Flow[] {
    return this.database.access((db) => {
      const rows = db.prepare(`SELECT f.id, f.name, f.created_at, f.updated_at,
        fe.id AS event_id, fe.event_definition_id, fe.position
        FROM flows f LEFT JOIN flow_events fe ON fe.flow_id = f.id
        WHERE f.name LIKE ? ESCAPE '\\'
        ORDER BY f.name COLLATE NOCASE, fe.position`)
        .all(`%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`) as FlowWithEventRow[]
      const flows = new Map<string, Flow>()
      for (const row of rows) {
        let flow = flows.get(row.id)
        if (!flow) {
          flow = { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at, events: [] }
          flows.set(row.id, flow)
        }
        if (row.event_id && row.event_definition_id && row.position !== null) flow.events.push({ id: row.event_id, flowId: row.id, eventDefinitionId: row.event_definition_id, position: row.position })
      }
      return [...flows.values()]
    })
  }
  private insertEvents(db: BetterSqlite3.Database, flow: Flow): void {
    const insert = db.prepare('INSERT INTO flow_events (id, flow_id, event_definition_id, position) VALUES (?, ?, ?, ?)')
    for (const event of flow.events) insert.run(event.id, flow.id, event.eventDefinitionId, event.position)
  }
  private map(db: BetterSqlite3.Database, row: FlowRow): Flow {
    const events = db.prepare('SELECT id, flow_id, event_definition_id, position FROM flow_events WHERE flow_id = ? ORDER BY position').all(row.id) as FlowEventRow[]
    return {
      id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at,
      events: events.map((event): FlowEvent => ({ id: event.id, flowId: event.flow_id, eventDefinitionId: event.event_definition_id, position: event.position })),
    }
  }
}
