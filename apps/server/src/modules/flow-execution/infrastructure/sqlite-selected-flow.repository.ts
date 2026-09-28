import type { SqliteDatabase } from '../../../database/sqlite.database.js'
import type { SelectedFlowRepository } from '../application/selected-flow.repository.js'

export class SqliteSelectedFlowRepository implements SelectedFlowRepository {
  constructor(private readonly database: SqliteDatabase) {}
  listIds(): string[] {
    return this.database.access((db) => (db.prepare('SELECT flow_id FROM selected_flows ORDER BY position').all() as Array<{ flow_id: string }>).map((row) => row.flow_id))
  }
  replace(flowIds: string[], createdAt: number, createId: () => string): void {
    this.database.access((db) => db.transaction(() => {
      db.prepare('DELETE FROM selected_flows').run()
      const insert = db.prepare('INSERT INTO selected_flows (id, flow_id, position, created_at) VALUES (?, ?, ?, ?)')
      flowIds.forEach((flowId, position) => insert.run(createId(), flowId, position, createdAt))
    })())
  }
}
