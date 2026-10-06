# Storage management

Settings → Storage reports usage and exposes confirmation-gated module clears.
The server owns the dependency graph in `modules/storage/storage.service.ts`:

- Recording Session clears recordings only.
- Event Rules clears rules, all build flows, and flow execution selections/results.
- Build Flow clears all build flows and flow execution selections/results.
- Flow Execution clears saved selections and in-memory execution snapshots only.
- Clear All clears these four modules. Connector preferences, event tag definitions,
  and live events are not included.

`GET /api/storage` returns module names, bytes, affected modules (`clears`) and a
total. `GET /api/storage/status` returns deletion availability, blockers, and the
latest persisted operation. `POST /api/storage/clear` requires
`{ operationId, target, confirmed: true }`; target is `recordings`, `rules`,
`build`, `execution`, or `all`. It accepts the operation with HTTP 202. Reusing
the same operation ID returns its existing state and never repeats the delete.
The frontend uses the same returned dependency
metadata for confirmation text, avoiding a duplicate dependency graph.

Usage is logical stored payload bytes: the summed UTF-8 byte lengths of non-null
SQLite column values (numeric values use their textual representation). This is
not the physical database file size, SQLite index/page overhead, free pages, or
runtime memory size. An empty module reports 0 B. Deletion makes SQLite space
reusable; it does not VACUUM the database. Flow Execution currently persists only
selected flows, although clearing also discards its in-memory results.

Dependent tables are deleted in one transaction. Runtime rule indexes and
execution snapshots are invalidated after success. Every clear is rejected while
Live Stream is playing, recording is active, validation is active, or another
clear is running. Rejected clears do not partially delete other modules.

Usage is calculated asynchronously in a separate, read-only Node process using
one SQLite snapshot for all module totals. Navigating away from Settings aborts
the browser request; the server kills its calculation process on disconnect.
This interrupts even a running native SQLite scan. Server shutdown also aborts
calculations. In-memory test databases are serialized to the child; production
file-backed databases are opened directly, without a main-thread scan.

Settings shows shimmer while awaiting usage on each visit. There is no Refresh
button. A failed calculation offers Retry. A `storage.cleared` WebSocket message
invalidates affected tab caches and triggers a new cancellable usage calculation.
It does not remount Settings and dismiss an in-flight confirmation dialog.

After confirmation, the server persists a RUNNING operation before doing the
delete. The confirmation dialog closes and a global blocker disables application
navigation, browser back, and unload while the operation runs. WebSocket updates
and status polling release the blocker and refresh affected tabs and usage.
Closing the webpage does not cancel an accepted delete; reopening hydrates the
persisted status.

Deletion remains one synchronous SQLite write transaction on the server. Graceful
shutdown waits for an accepted operation. A process stop during the transaction
causes SQLite rollback; on restart, any operation still marked RUNNING becomes
INTERRUPTED and the UI reports the failure. There is a small crash window after
SQLite commit and before the completion status write, so an interrupted result
asks the user to refresh sizes to verify the final state.

Tests use an isolated in-memory database for the dependency matrix, confirmation
validation, active-session guards, zero usage, index/snapshot invalidation,
foreign-key integrity, and rollback on injected database failure. UI verification
must not clear a user's real data as a test.
