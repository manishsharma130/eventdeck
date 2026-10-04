# Live Stream connectors

EventDeck consumes one device-scoped `adb logcat -v threadtime` stream. Enabled
connectors supply tag filters, followed by `*:S`. Generic line parsing extracts
metadata, a tag-indexed registry selects a connector, and SDK parsers return:

```ts
{ eventName: string, eventTag: string, timestamp: number, eventParams: Record<string, unknown> }
```

The existing `live_stream.event` WebSocket envelope, event bus, recording store,
and flow execution consumer remain in place. Core logs preserve any string `eventTag` supplied by the app, including custom
tags, and fall back to `analytics_event` when no valid tag is supplied; optional fields outside the normalized contract are not
forwarded. Existing stored recordings are not migrated.

## Server layout

```text
src/
  logcat/
    logcat.types.ts
    logcat-line-parser.ts
  connectors/
    connector.types.ts
    connector-registry.ts
    payload-utils.ts
    analytics-event/analytics-event.connector.ts
    google-analytics/
      google-analytics.connector.ts
      google-analytics.parser.ts
      google-analytics.setup.ts
    branch/
      branch.connector.ts
      branch.parser.ts
    moengage/
      moengage.connector.ts
      moengage.parser.ts
  events/
    analytics-event.types.ts
    event-normalizer.ts
  settings/connector-settings.ts
  modules/live-stream/
    infrastructure/real-adb-client.ts   # ADB execution and line delivery
    application/live-stream.service.ts # lifecycle and publishing
    api/live-stream.routes.ts          # stream and settings endpoints
```

## Configuration

`GET /api/settings/connectors` returns central connector metadata and settings.
`PUT /api/settings/connectors` accepts exactly three booleans:
`google_analytics`, `branch`, and `moengage`. All default to true. AnalyticsEvent
is always enabled. The Settings tab uses these endpoints; preferences last for
the server process and reset on restart. They apply to all connected clients.

Changing settings stops the existing child before starting its replacement.
Lifecycle operations are serialized so concurrent play, device-selection, and
settings requests cannot create overlapping children. Paused/playing state and
the active recording session survive filter changes. A restart introduces a
short collection gap; no historical replay or deduplication is implemented.

Before collection, Google Analytics setup executes, in order:

```text
adb -s <deviceId> shell setprop log.tag.FA VERBOSE
adb -s <deviceId> shell setprop log.tag.FA-SVC VERBOSE
```

Setup also runs when Google Analytics is enabled with a selected device while
collection is stopped. Disabling it never resets device properties. Failed
settings setup restores the previous settings and attempts to restore collection.

## Supported log formats and assumptions

- AnalyticsEvent: a JSON object with `eventName` and optional `eventParams` and
  numeric millisecond `timestamp`. Invalid/missing params become an empty object.
- FA / FA-SVC, verbose: `Logging event: origin=app,name=...,params=Bundle[{...}]`.
  Bundles support nested objects/arrays, quoted strings, null, booleans and safe
  numbers. Leading-zero identifiers and unsafe integers stay strings.
- BranchSDK, verbose: a `setPost` marker followed by a balanced JSON object with
  `name`; remaining properties become parameters.
- MoEngage, debug: `Core_EventHandler trackEvent()` followed by a balanced object
  with `Event.name`, `Event.attributes.EVENT_ATTRS`, and optional `Event.time`.
  Only the known unquoted outer `Event` key is repaired. EVENT_ATTRS may be an
  object or serialized JSON object. Missing/invalid attributes reject the event.

Timestamps prefer a valid numeric SDK millisecond timestamp, then Logcat time.
Threadtime has no year or timezone: the parser uses the host timezone and nearest
adjacent year. Device/host clock or timezone differences require future handling.
Payloads must fit one Logcat entry; multi-entry reassembly is not implemented.
Unquoted Bundle strings containing commas are intrinsically ambiguous.

Fixtures use the formats supplied in the architecture document, with synthetic
edge cases. Actual app logs still need device verification, particularly full
MoEngage payloads and SDK-version differences. Branch and MoEngage logging must
already be enabled by the Android app. No app source is modified.

## Verification

Unit coverage includes malformed SDK payloads, balanced extraction, normalization,
filter generation, setup commands, parser isolation, and threadtime year rollover.
Integration tests feed mixed SDK lines through LiveStreamService into recordings
and WebSocket publication, exercise concurrent restarts and device setup, and
verify that paused recordings continue while disabled connectors are ignored.
API tests reject attempts to toggle the core connector.
