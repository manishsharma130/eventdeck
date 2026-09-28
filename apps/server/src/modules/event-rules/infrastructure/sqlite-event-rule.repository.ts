import type BetterSqlite3 from 'better-sqlite3'
import type { SqliteDatabase } from '../../../database/sqlite.database.js'
import type { EventRuleRepository } from '../application/event-rule.repository.js'
import type { EventDefinition, EventRuleCondition } from '../domain/event-rule.types.js'

type DefinitionRow = { id: string; name: string; event_value: string; created_at: number; updated_at: number }
type RuleRow = { id: string; param_key: string; match_type: EventRuleCondition['matchType']; expected_value: string | null }

export class SqliteEventRuleRepository implements EventRuleRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(definition: EventDefinition, signature: string): EventDefinition {
    return this.database.access((db) => db.transaction(() => {
      db.prepare('INSERT INTO event_definitions (id, name, event_value, rule_signature, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(definition.id, definition.name, definition.eventValue, signature, definition.createdAt, definition.updatedAt)
      this.insertRules(db, definition)
      return definition
    })())
  }

  update(definition: EventDefinition, signature: string): EventDefinition {
    return this.database.access((db) => db.transaction(() => {
      db.prepare('UPDATE event_definitions SET name = ?, event_value = ?, rule_signature = ?, updated_at = ? WHERE id = ?')
        .run(definition.name, definition.eventValue, signature, definition.updatedAt, definition.id)
      db.prepare('DELETE FROM event_rule_conditions WHERE event_definition_id = ?').run(definition.id)
      this.insertRules(db, definition)
      return definition
    })())
  }

  delete(id: string): boolean {
    return this.database.access((db) => db.transaction(() => {
      const affected = (db.prepare('SELECT DISTINCT flow_id FROM flow_events WHERE event_definition_id = ?').all(id) as Array<{ flow_id: string }>).map((row) => row.flow_id)
      const deleted = db.prepare('DELETE FROM event_definitions WHERE id = ?').run(id).changes > 0
      const selectEvents = db.prepare('SELECT id FROM flow_events WHERE flow_id = ? ORDER BY position')
      const updatePosition = db.prepare('UPDATE flow_events SET position = ? WHERE id = ?')
      for (const flowId of affected) (selectEvents.all(flowId) as Array<{ id: string }>).forEach((event, position) => updatePosition.run(position, event.id))
      return deleted
    })())
  }

  findById(id: string): EventDefinition | null {
    return this.database.access((db) => {
      const row = db.prepare('SELECT id, name, event_value, created_at, updated_at FROM event_definitions WHERE id = ?').get(id) as DefinitionRow | undefined
      return row ? this.mapDefinition(db, row) : null
    })
  }

  findByName(name: string): EventDefinition | null {
    return this.database.access((db) => {
      const row = db.prepare('SELECT id, name, event_value, created_at, updated_at FROM event_definitions WHERE name = ? COLLATE NOCASE').get(name) as DefinitionRow | undefined
      return row ? this.mapDefinition(db, row) : null
    })
  }

  findBySignature(signature: string): EventDefinition | null {
    return this.database.access((db) => {
      const row = db.prepare('SELECT id, name, event_value, created_at, updated_at FROM event_definitions WHERE rule_signature = ?').get(signature) as DefinitionRow | undefined
      return row ? this.mapDefinition(db, row) : null
    })
  }

  list(): EventDefinition[] {
    return this.database.access((db) => (db.prepare('SELECT id, name, event_value, created_at, updated_at FROM event_definitions ORDER BY name COLLATE NOCASE').all() as DefinitionRow[])
      .map((row) => this.mapDefinition(db, row)))
  }

  countFlowReferences(id: string): number {
    return this.database.access((db) => (db.prepare('SELECT COUNT(DISTINCT flow_id) AS count FROM flow_events WHERE event_definition_id = ?').get(id) as { count: number }).count)
  }

  private insertRules(db: BetterSqlite3.Database, definition: EventDefinition): void {
    const insert = db.prepare('INSERT INTO event_rule_conditions (id, event_definition_id, param_key, match_type, expected_value, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    for (const rule of definition.rules) insert.run(rule.id, definition.id, rule.paramKey, rule.matchType, rule.expectedValue ?? null, definition.createdAt)
  }

  private mapDefinition(db: BetterSqlite3.Database, row: DefinitionRow): EventDefinition {
    const rules = db.prepare('SELECT id, param_key, match_type, expected_value FROM event_rule_conditions WHERE event_definition_id = ? ORDER BY param_key, match_type, expected_value').all(row.id) as RuleRow[]
    return {
      id: row.id, name: row.name, eventValue: row.event_value, createdAt: row.created_at, updatedAt: row.updated_at,
      rules: rules.map((rule) => ({ id: rule.id, paramKey: rule.param_key, matchType: rule.match_type, ...(rule.expected_value === null ? {} : { expectedValue: rule.expected_value }) })),
    }
  }
}
