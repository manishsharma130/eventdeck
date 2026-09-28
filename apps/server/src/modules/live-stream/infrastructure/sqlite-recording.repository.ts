import type { SqliteDatabase } from '../../../database/sqlite.database.js'
import type { RecordingRepository } from '../application/recording.repository.js'
import { parseRecordedEvent } from '../application/recording.repository.js'
import type { RecordedEvent, RecordedSession } from '../domain/live-stream.types.js'

type SessionRow = { id: string; name: string; device_id: string; started_at: number; ended_at: number | null; status: RecordedSession['status']; total_events: number }
type EventRow = { id: string; session_id: string; sequence: number; event_json: string; received_at: number }

export class SqliteRecordingRepository implements RecordingRepository {
  constructor(private readonly database: SqliteDatabase) {}
  start(session: RecordedSession): RecordedSession {
    this.database.access((db) => db.prepare('INSERT INTO recorded_sessions (id, name, device_id, started_at, ended_at, status, total_events) VALUES (?, ?, ?, ?, NULL, ?, 0)')
      .run(session.id, session.name, session.deviceId, session.startedAt, session.status))
    return session
  }
  append(sessionId: string, recorded: RecordedEvent): void {
    this.database.access((db) => db.transaction(() => {
      db.prepare('INSERT INTO recorded_session_events (id, session_id, sequence, event_name, event_tag, event_params, event_json, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(recorded.id, sessionId, recorded.sequence, recorded.event.eventName, recorded.event.eventTag ?? null, JSON.stringify(recorded.event.eventParams), JSON.stringify(recorded.event), recorded.receivedAt)
      db.prepare('UPDATE recorded_sessions SET total_events = total_events + 1 WHERE id = ?').run(sessionId)
    })())
  }
  complete(sessionId: string, name: string, endedAt: number): RecordedSession {
    return this.database.access((db) => {
      db.prepare("UPDATE recorded_sessions SET name = ?, ended_at = ?, status = 'COMPLETED' WHERE id = ?").run(name, endedAt, sessionId)
      const row = db.prepare('SELECT * FROM recorded_sessions WHERE id = ?').get(sessionId) as SessionRow
      return this.mapSession(row)
    })
  }
  findById(id: string): (RecordedSession & { events: RecordedEvent[] }) | null {
    return this.database.access((db) => {
      const row = db.prepare('SELECT * FROM recorded_sessions WHERE id = ?').get(id) as SessionRow | undefined
      if (!row) return null
      const events = db.prepare('SELECT id, session_id, sequence, event_json, received_at FROM recorded_session_events WHERE session_id = ? ORDER BY sequence').all(id) as EventRow[]
      return { ...this.mapSession(row), events: events.map((event) => ({ id: event.id, sessionId: event.session_id, sequence: event.sequence, event: parseRecordedEvent(event.event_json), receivedAt: event.received_at })) }
    })
  }
  list(): RecordedSession[] { return this.database.access((db) => (db.prepare('SELECT * FROM recorded_sessions ORDER BY started_at DESC').all() as SessionRow[]).map(this.mapSession)) }
  nextSequence(sessionId: string): number {
    return this.database.access((db) => (db.prepare('SELECT COALESCE(MAX(sequence), -1) + 1 AS sequence FROM recorded_session_events WHERE session_id = ?').get(sessionId) as { sequence: number }).sequence)
  }
  private readonly mapSession = (row: SessionRow): RecordedSession => ({
    id: row.id, name: row.name, deviceId: row.device_id, startedAt: row.started_at, endedAt: row.ended_at, status: row.status, totalEvents: row.total_events,
  })
}
