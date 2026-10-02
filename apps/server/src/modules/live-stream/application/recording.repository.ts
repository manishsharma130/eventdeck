import type { LiveEvent } from '../../event-rules/domain/event-rule.types.js'
import type { RecordedEvent, RecordedSession } from '../domain/live-stream.types.js'

export interface RecordingRepository {
  start(session: RecordedSession): RecordedSession
  append(sessionId: string, event: RecordedEvent): void
  complete(sessionId: string, name: string, endedAt: number): RecordedSession
  findById(id: string): (RecordedSession & { events: RecordedEvent[] }) | null
  list(): RecordedSession[]
  deleteMany(ids: string[]): number
  nextSequence(sessionId: string): number
}

export function parseRecordedEvent(json: string): LiveEvent { return JSON.parse(json) as LiveEvent }
