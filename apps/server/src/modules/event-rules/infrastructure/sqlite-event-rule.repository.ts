import type BetterSqlite3 from 'better-sqlite3'
import type { SqliteDatabase } from '../../../database/sqlite.database.js'
import type { EventRuleRepository } from '../application/event-rule.repository.js'
import type { EventDefinition, EventRuleCondition } from '../domain/event-rule.types.js'

type DefinitionRow = { id: string; name: string; event_value: string; created_at: number; updated_at: number }
type RuleRow = { id: string; param_key: string; match_type: EventRuleCondition['matchType']; expected_value: string | null }
type DefinitionWithRuleRow = DefinitionRow & { rule_id: string | null; param_key: string | null; match_type: EventRuleCondition['matchType'] | null; expected_value: string | null }

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
    return this.deleteMany([id]) > 0
  }

  deleteMany(ids: string[]): number {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return 0
    return this.database.access((db) => db.transaction(() => {
      const placeholders = uniqueIds.map(() => '?').join(',')
      const affected = (db.prepare(`SELECT DISTINCT flow_id FROM flow_events WHERE event_definition_id IN (${placeholders})`).all(...uniqueIds) as Array<{ flow_id: string }>).map((row) => row.flow_id)
      const deleted = db.prepare(`DELETE FROM event_definitions WHERE id IN (${placeholders})`).run(...uniqueIds).changes
      const selectEvents = db.prepare('SELECT id FROM flow_events WHERE flow_id = ? ORDER BY position')
      const updatePosition = db.prepare('UPDATE flow_events SET position = ? WHERE id = ?')
      const deleteFlow = db.prepare('DELETE FROM flows WHERE id = ?')
      for (const flowId of affected) {
        const events = selectEvents.all(flowId) as Array<{ id: string }>
        if (events.length === 0) deleteFlow.run(flowId)
        else events.forEach((event, position) => updatePosition.run(position, event.id))
      }
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

  findManyByIds(ids: string[]): EventDefinition[] {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []
    const placeholders = uniqueIds.map(() => '?').join(',')
    return this.database.access((db) => this.mapJoinedRows(db.prepare(`SELECT d.id, d.name, d.event_value, d.created_at, d.updated_at,
      r.id AS rule_id, r.param_key, r.match_type, r.expected_value
      FROM event_definitions d LEFT JOIN event_rule_conditions r ON r.event_definition_id = d.id
      WHERE d.id IN (${placeholders})
      ORDER BY d.name COLLATE NOCASE, r.param_key, r.match_type, r.expected_value`).all(...uniqueIds) as DefinitionWithRuleRow[]))
  }

  list(): EventDefinition[] {
    return this.database.access((db) => {
      const rows = db.prepare(`SELECT d.id, d.name, d.event_value, d.created_at, d.updated_at,
        r.id AS rule_id, r.param_key, r.match_type, r.expected_value
        FROM event_definitions d LEFT JOIN event_rule_conditions r ON r.event_definition_id = d.id
        ORDER BY d.name COLLATE NOCASE, r.param_key, r.match_type, r.expected_value`).all() as DefinitionWithRuleRow[]
      return this.mapJoinedRows(rows)
    })
  }

  private mapJoinedRows(rows: DefinitionWithRuleRow[]): EventDefinition[] {
    const definitions = new Map<string, EventDefinition>()
    for (const row of rows) {
      let definition = definitions.get(row.id)
      if (!definition) {
        definition = { id: row.id, name: row.name, eventValue: row.event_value, createdAt: row.created_at, updatedAt: row.updated_at, rules: [] }
        definitions.set(row.id, definition)
      }
      if (row.rule_id && row.param_key && row.match_type) definition.rules.push({ id: row.rule_id, paramKey: row.param_key, matchType: row.match_type, ...(row.expected_value === null ? {} : { expectedValue: row.expected_value }) })
    }
    return [...definitions.values()]
  }

  countFlowReferences(id: string): number {
    return this.database.access((db) => (db.prepare('SELECT COUNT(DISTINCT flow_id) AS count FROM flow_events WHERE event_definition_id = ?').get(id) as { count: number }).count)
  }

  countFlowReferencesMany(ids: string[]): number {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return 0
    const placeholders = uniqueIds.map(() => '?').join(',')
    return this.database.access((db) => (db.prepare(`SELECT COUNT(DISTINCT flow_id) AS count FROM flow_events WHERE event_definition_id IN (${placeholders})`).get(...uniqueIds) as { count: number }).count)
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
