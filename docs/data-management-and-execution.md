# Data management and execution

[← Back to README](../README.md) · [Server setup](server-foundation-setup.md) · [Architecture](architecture.md) · [File reference](file-reference.md)

This guide describes the implemented contracts for EventDeck's Live Stream, Event Rules, Build Flow, and Flow Execution modules.

## Shared conventions

All HTTP endpoints use JSON. Application errors have the common shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable explanation",
    "details": {}
  }
}
```

All server WebSocket messages use the versioned envelope:

```json
{
  "type": "module.action",
  "version": 1,
  "timestamp": 1727540000000,
  "payload": {}
}
```

Connect at `ws://127.0.0.1:4732/ws`. HTTP is used for state, queries, and commands. WebSocket is used for realtime updates.

## Live Stream

The production adapter runs the equivalent of:

```bash
adb -s <deviceId> logcat -v raw -s AnalyticsEvent:I '*:S'
```

Every non-empty raw message is parsed as one JSON event object. The same object is published to the Live Stream UI, recorded when recording is active, and offered to an active Flow Execution context.

Runtime state keeps these concerns separate:

```json
{
  "selectedDeviceId": "emulator-5554",
  "streamState": "PLAYING",
  "isRecording": false,
  "recordingSessionId": null,
  "recordingStartedForDeviceId": null
}
```

`PLAYING` publishes `live_stream.event`. `PAUSED` suppresses that visual update while ingestion and recording continue. `STOPPED` suppresses visual updates; if recording is active, ADB ingestion remains alive until recording stops.

Device changes clear the UI through `live_stream.device_changed`. A device change during recording returns `RECORDING_ACTIVE_DEVICE_CHANGE_BLOCKED`; the current device and recording remain unchanged.

### Live Stream endpoints

- `GET /api/devices` lists devices reported by `adb devices -l`.
- `GET /api/live-stream/state` returns runtime state.
- `PUT /api/live-stream/device` with `{ "deviceId": "emulator-5554" }` selects a device.
- `POST /api/live-stream/play` starts or resumes visual streaming.
- `POST /api/live-stream/pause` pauses visual updates without killing Logcat.
- `POST /api/live-stream/stop` stops visual streaming.
- `POST /api/live-stream/recording/start` with `{ "name": "Checkout test" }` creates a device-bound session.
- `POST /api/live-stream/recording/stop` with optional `{ "name": "Final name" }` finalizes it.
- `GET /api/recorded-sessions` lists session metadata.
- `GET /api/recorded-sessions/:id` returns a session and its ordered complete event objects.

### Live Stream events

- `live_stream.event`
- `live_stream.state_changed`
- `live_stream.device_changed`
- `live_stream.parse_error`
- `live_stream.error`
- `recording.started`
- `recording.stopped`

## Event Rules

An Event Definition contains a unique human-readable name, an event value matched against incoming `eventName`, and zero or more conditions.

Supported condition types are:

- `exact` — string equality;
- `contains` — substring matching;
- `exists` — checks own-property presence, including falsey values; and
- `regex` — a regular expression compiled once for runtime use.

Example create request:

```json
{
  "name": "Home Screen Open",
  "eventValue": "app_open",
  "rules": [
    {
      "paramKey": "screen",
      "matchType": "exact",
      "expectedValue": "home"
    }
  ]
}
```

Names are unique case-insensitively. Event values may be reused. Matching uniqueness is enforced by a SHA-256 signature of the normalized event value and complete sorted rule set, so rule order does not affect duplicate detection.

Invalid regular expressions are rejected on save. A duplicate signature response includes the existing definition and matching rules rather than exposing only the hash.

### Event Rule endpoints

- `GET /api/event-rules`
- `GET /api/event-rules/:id`
- `POST /api/event-rules`
- `PUT /api/event-rules/:id`
- `DELETE /api/event-rules/:id`

Create/update writes the definition and all conditions in one transaction. The runtime index is updated only after SQLite succeeds. Deletion reports `affectedFlows` and cascade-removes only the definition's flow mappings; remaining flow event positions are compacted.

## Build Flow

A flow is a uniquely named ordered list of Event Definition IDs. Definitions are referenced rather than copied, so definition updates automatically affect future execution snapshots.

Example create request:

```json
{
  "name": "Checkout Journey",
  "eventDefinitionIds": ["definition-1", "definition-2"]
}
```

The same composition may be saved under different flow names. Order is preserved. The same Event Definition cannot appear twice in one flow. Every referenced definition is validated before the transaction begins.

### Build Flow endpoints

- `GET /api/flows` lists flows.
- `GET /api/flows?search=checkout` performs escaped case-insensitive name search.
- `GET /api/flows/:id` returns one ordered flow.
- `POST /api/flows` creates a flow and mappings transactionally.
- `PUT /api/flows/:id` replaces its current name and ordered mappings transactionally.
- `DELETE /api/flows/:id` deletes the flow and mappings, never its Event Definitions.

## Flow Execution

Selected flows are persisted separately from flow definitions. Their order becomes the stable `flowIndex` for an execution snapshot.

Replace the selected set with:

```http
PUT /api/flow-execution/selected-flows
```

```json
{
  "flowIds": ["flow-1", "flow-2"]
}
```

`GET /api/flow-execution` returns complete UI-ready mappings: flow, ordered flow events, definitions, and rules. The UI does not need to perform joins.

Start live validation with:

```http
POST /api/flow-execution/validate
```

```json
{}
```

At start, the server creates an immutable in-memory snapshot. Definitions are deduplicated by stable ID, indexed by event value, and mapped to every selected-flow reference. Database edits made during execution affect only the next run.

For each incoming event, candidate lookup is average O(1). Only unresolved definitions sharing its `eventName` are evaluated. Rules short-circuit on failure. A definition used by multiple flows is evaluated once and updates all mapped references.

Successful matches publish `flow_execution.event_definition_passed` with stable IDs plus snapshot `flowIndex` and `eventIndex` values.

Stop live validation with:

```http
POST /api/flow-execution/stop
```

```json
{
  "reason": "USER_STOPPED"
}
```

Pending events become failed. The `flow_execution.validation_completed` result includes per-event outcomes and flow summaries with `totalEvents`, `passedEvents`, `failedEvents`, and `PASSED`, `PARTIAL`, or `FAILED`.

### Recorded-session execution

To validate a complete recording instead of waiting for live events:

```json
{
  "recordedSessionId": "session-id"
}
```

Send that body to `POST /api/flow-execution/validate`. The server creates the same immutable snapshot, replays ordered recorded events, and completes automatically with reason `SOURCE_COMPLETED`.

### Execution endpoints and events

- `GET /api/flow-execution` returns selected mapped flows.
- `PUT /api/flow-execution/selected-flows` replaces selection and display order.
- `GET /api/flow-execution/status` returns active/frozen runtime state.
- `POST /api/flow-execution/validate` starts live or recorded validation.
- `POST /api/flow-execution/stop` finalizes live validation.
- `flow_execution.started` announces the snapshot.
- `flow_execution.event_definition_passed` reports affected UI positions.
- `flow_execution.validation_error` reports an evaluation exception without silently passing a definition.
- `flow_execution.validation_completed` reports the final summary.

## SQLite tables

Migration `0001-domain` creates:

- `recorded_sessions` and `recorded_session_events`;
- `event_definitions` and `event_rule_conditions`;
- `flows` and `flow_events`; and
- `selected_flows`.

Foreign keys are enabled. Parent deletes cascade only to owned mapping/detail rows. Saves involving parent/detail records use SQLite transactions. `_eventdeck_migrations` remains the migration audit table.

## Verification

Run the complete validation suite:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Tests cover signature normalization, all match types, duplicate errors, flow composition, selected execution snapshots, partial completion, temporary SQLite migrations, recording while paused, blocked device switching, WebSocket envelopes, server injection, and graceful shutdown.
