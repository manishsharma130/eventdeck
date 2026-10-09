# Independent event tags

Connector settings configure log collection and parsing. Event tag definitions
configure frontend filter options and display labels. Neither reads or changes
the other's configuration.

`apps/web/src/state/event-tags-store.ts` owns definitions with `id`, `name`,
`value`, and `type` (`predefined` or `custom`). Defaults are Google Analytics
(`google_analytics`), Branch (`branch`), and MoEngage (`moengage`).

Settings → Event Tags supports adding a display name and exact matching value,
and deleting custom definitions. Predefined definitions cannot be deleted.
Duplicate values and blank fields are rejected. Values retain case and spaces.
Custom definitions persist in localStorage for the current browser and origin;
they are not server-wide or synchronized between open tabs.

Live Stream uses these definitions for its dropdown and tag display labels.
A selected definition matches `event.eventTag` by exact equality. All Tags uses
a null selection so even a literal eventTag of `All Tags` can be filtered safely.
Unknown tags remain visible under All Tags without registering definitions.
Deleting the selected definition falls back to All Tags on the Live Stream page.
No events, recordings, incoming tag values, or connector settings are modified.
The existing AnalyticsEvent connector continues preserving incoming eventTag.

Verification: `pnpm test:web` includes event-tag persistence, validation,
predefined protection, unknown events, deletion independence, and exact matching.
