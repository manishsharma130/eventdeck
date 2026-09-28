import type { Migration } from '../migration-runner.js'

export const initialDomainMigration: Migration = {
  version: 1,
  name: 'consolidated_data_management',
  up(database) {
    database.exec(`
      CREATE TABLE recorded_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        device_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL CHECK (status IN ('RECORDING', 'COMPLETED')),
        total_events INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE recorded_session_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        event_tag TEXT,
        event_params TEXT NOT NULL,
        event_json TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES recorded_sessions(id) ON DELETE CASCADE,
        UNIQUE (session_id, sequence)
      );

      CREATE TABLE event_definitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        event_value TEXT NOT NULL,
        rule_signature TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE event_rule_conditions (
        id TEXT PRIMARY KEY,
        event_definition_id TEXT NOT NULL,
        param_key TEXT NOT NULL,
        match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains', 'exists', 'regex')),
        expected_value TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (event_definition_id) REFERENCES event_definitions(id) ON DELETE CASCADE
      );

      CREATE TABLE flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE flow_events (
        id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL,
        event_definition_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (event_definition_id) REFERENCES event_definitions(id) ON DELETE CASCADE,
        UNIQUE (flow_id, position),
        UNIQUE (flow_id, event_definition_id)
      );

      CREATE TABLE selected_flows (
        id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL UNIQUE,
        position INTEGER NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_recorded_events_session ON recorded_session_events(session_id, sequence);
      CREATE INDEX idx_event_definition_value ON event_definitions(event_value);
      CREATE INDEX idx_rule_event_definition ON event_rule_conditions(event_definition_id);
      CREATE INDEX idx_flow_events_flow ON flow_events(flow_id, position);
      CREATE INDEX idx_flow_events_definition ON flow_events(event_definition_id);
    `)
  },
}
