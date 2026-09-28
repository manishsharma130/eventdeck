# EventDeck server foundation setup

[← Back to README](../README.md) · [Architecture](architecture.md) · [Development](development.md) · [File reference](file-reference.md)

This guide explains how to install, configure, run, verify, test, and extend the EventDeck local server foundation. It is intended both for someone setting up the repository for the first time and for contributors who need to understand how the server is assembled.

## What this setup provides

The current server is a testable modular-monolith foundation built with:

- Node.js and strict TypeScript;
- Fastify for HTTP;
- `@fastify/websocket` and `ws` for realtime connections;
- `better-sqlite3` for local persistence;
- Zod for environment and future API-boundary validation;
- Pino-compatible structured logging; and
- Vitest for API, SQLite, WebSocket, and lifecycle tests.

The implemented public interfaces are:

- `GET /health` for a lightweight liveness check;
- `GET /api/status` for server, database, and package status;
- `GET /ws` with a WebSocket upgrade for realtime events; and
- the `eventdeck` CLI for starting and stopping the local process.

This foundation intentionally does **not** include Live Stream, Recorded Sessions, Event Rules, Build Flow, Flow Execution, ADB integration, or tables for those features. The only SQLite table created is the internal `_eventdeck_migrations` metadata table.

## Prerequisites

Install the following tools before working with the repository:

- Node.js 20 or newer;
- pnpm 10.x; and
- Git for normal source-control workflows.

Confirm the active versions:

```bash
node --version
pnpm --version
git --version
```

The repository declares its expected package manager in the root `package.json`. If pnpm is unavailable and your Node.js installation includes Corepack, it can normally be enabled with:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
```

## Install the workspace

From the repository root, install all web and server dependencies:

```bash
pnpm install
```

The root `pnpm-workspace.yaml` discovers packages under `apps/*`. It also permits the native install step required by `better-sqlite3`. Keep `pnpm-lock.yaml` committed so all contributors and CI use the same dependency graph.

If the native SQLite dependency fails to install, first verify that you are using a supported Node.js version and current system build tools. Then retry a clean package-manager install without manually editing generated files.

## Default local configuration

Without environment overrides, the server uses:

```text
Host:          127.0.0.1
Port:          4732
HTTP base:     http://127.0.0.1:4732
WebSocket:     ws://127.0.0.1:4732/ws
Database:      ~/.eventdeck/eventdeck.db
Log level:     info
```

Binding to `127.0.0.1` makes the server available only on the local computer by default. This is appropriate for a local developer companion process and avoids exposing the service to the local network.

The database parent directory is created automatically. SQLite creates the database file when the server initializes it.

## Environment variables

The server reads four optional variables at startup:

- `EVENTDECK_HOST` — interface on which Fastify listens;
- `EVENTDECK_PORT` — integer from `0` through `65535`;
- `EVENTDECK_DB_PATH` — SQLite database file path, or `:memory:` for short-lived development use;
- `EVENTDECK_LOG_LEVEL` — `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`.

Example using a project-local development database and debug logging:

```bash
EVENTDECK_HOST=127.0.0.1 \
EVENTDECK_PORT=5000 \
EVENTDECK_DB_PATH=/tmp/eventdeck-development.db \
EVENTDECK_LOG_LEVEL=debug \
pnpm dev:server
```

Environment values are validated by Zod before the HTTP server starts. Invalid ports, empty paths, or unsupported log levels cause a clear startup failure instead of leaving a partially initialized process.

The web application has a separate build-time variable:

```bash
VITE_EVENTDECK_WEBSOCKET_URL=ws://127.0.0.1:5000/ws pnpm dev:web
```

When changing the server port or WebSocket path, update the web value to match. The default web endpoint is `ws://127.0.0.1:4732/ws`.

## Start EventDeck in development

Use two terminals from the repository root.

In the first terminal, start the server with TypeScript watch mode:

```bash
pnpm dev:server
```

The CLI prints the HTTP and WebSocket addresses after the database, migrations, plugins, and routes initialize successfully.

In the second terminal, start the React application:

```bash
pnpm dev:web
```

Open the URL printed by Vite, normally `http://localhost:5173`. The page should report `Connected with EventDeck`. If the server stops, the page changes to `Not connected with EventDeck` and retries every two seconds.

Stop either development process with `Ctrl+C`. The server handles `SIGINT` and `SIGTERM`, stops accepting requests, closes WebSocket clients, closes Fastify, and then closes SQLite.

## Verify the HTTP API

Check server liveness:

```bash
curl --fail http://127.0.0.1:4732/health
```

Expected response:

```json
{"status":"ok"}
```

Check the server and database status:

```bash
curl --fail http://127.0.0.1:4732/api/status
```

Expected response:

```json
{
  "server": "connected",
  "database": "connected",
  "version": "1.0.0"
}
```

The health route is intentionally small. The status route performs the database health query and is more useful when diagnosing initialization or persistence issues.

## Verify the WebSocket connection

The browser connects to `/ws`. Immediately after registration, the server sends:

```json
{
  "type": "connection.ready",
  "version": 1,
  "timestamp": 1727540000000,
  "payload": {}
}
```

The timestamp is generated at send time and will differ. Every server WebSocket event follows the same envelope:

```ts
type WebSocketMessage<T = unknown> = {
  type: string
  version: number
  timestamp: number
  payload: T
}
```

Event names use the `module.action` convention, such as `connection.ready` or a future `flow_execution.completed`. HTTP remains responsible for queries and commands; WebSocket is reserved for realtime server-to-client updates.

You can verify the ready event in the browser developer console. It appears as an `EventDeck event` log. A command-line WebSocket client such as `websocat` can also connect when installed:

```bash
websocat ws://127.0.0.1:4732/ws
```

## SQLite initialization

Startup applies these settings before migrations run:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

They provide relational-integrity enforcement, better local read/write concurrency, and tolerance for brief lock contention.

The application layer depends on the small `Database` interface rather than importing `better-sqlite3`. The concrete `SqliteDatabase` adapter owns the native connection, pragmas, health query, transactions, and close behavior.

Automated tests never use `~/.eventdeck/eventdeck.db`. Database tests create a unique temporary directory and database, run the migration infrastructure, inspect it, close it, and remove it.

## Migration system

The migration runner creates `_eventdeck_migrations` to record each applied version, name, and timestamp. Migrations are sorted by numeric version and each pending migration is applied transactionally.

Future feature work should add a migration under `apps/server/src/database/migrations` and register it in `migrations/index.ts`. A migration has this shape:

```ts
import type { Migration } from '../migration-runner.js'

export const exampleMigration: Migration = {
  version: 1,
  name: 'example',
  up(database) {
    database.exec('CREATE TABLE example (...)')
  },
}
```

Then add it to the ordered migration list:

```ts
export const migrations: readonly Migration[] = [exampleMigration]
```

Migration version numbers must be unique and should never be changed after release. Do not put SQL in route handlers or application services. Feature repositories should live in their module's infrastructure layer and implement application-layer ports.

## Server startup lifecycle

Production startup proceeds in this order:

1. Load and validate environment configuration.
2. Create the structured logger.
3. Create the database directory and open SQLite.
4. Apply SQLite pragmas.
5. Create migration metadata and run pending migrations.
6. Create the WebSocket gateway.
7. Compose the explicit dependency container.
8. Create Fastify and register the global error handler.
9. Register the WebSocket plugin, HTTP routes, and `/ws` route.
10. Start listening on the configured host and port.

If initialization or `listen()` fails, startup rejects and the database is closed. The process does not intentionally continue with a partially working server.

`createServer(dependencies)` and `startServer(environment)` are separate by design. Tests can create an application and use Fastify injection without opening a production port, while the CLI uses the complete production composition path.

## Source layout

The main server directories are:

```text
apps/server/
├── bin/eventdeck.js
├── src/
│   ├── api/             HTTP routes and global error formatting
│   ├── config/          environment schema and configuration loading
│   ├── database/        database port, SQLite adapter, and migrations
│   ├── logging/         logger creation and logger type
│   ├── modules/         reserved home for isolated product features
│   ├── server/          Fastify factory, dependencies, and startup
│   ├── shared/          cross-cutting application errors and types
│   ├── websocket/       gateway, events, client tracking, and envelopes
│   ├── cli.ts           process output and signal handling
│   └── index.ts         reusable server exports
└── tests/
    ├── api/             injection-based HTTP tests
    ├── integration/     SQLite, WebSocket, and lifecycle tests
    └── helpers.ts       dependency fakes and server test factory
```

Feature modules should remain self-contained beneath `src/modules/<feature>` with `domain`, `application`, `infrastructure`, and `api` boundaries. Business logic must not depend directly on Fastify, raw WebSocket objects, SQLite, filesystem APIs, or future ADB processes.

## Error responses

Expected application failures use `AppError` and are formatted centrally:

```json
{
  "error": {
    "code": "EXAMPLE_ERROR",
    "message": "A readable explanation.",
    "details": {}
  }
}
```

Zod boundary failures return HTTP 400 with `VALIDATION_ERROR`. Unexpected failures are logged and return HTTP 500 with `INTERNAL_SERVER_ERROR`; internal stack traces are not sent to clients.

New routes should validate untrusted input before passing plain validated values to application services. They should throw shared errors and rely on the global handler instead of constructing a different error format in every route.

## Run automated checks

Run all available workspace tests:

```bash
pnpm test
```

Run only the server tests:

```bash
pnpm test:server
```

The foundation test suite covers:

- server creation without binding a network port;
- `/health` and `/api/status` through `app.inject()`;
- isolated SQLite creation and required pragmas;
- the absence of domain tables;
- WebSocket connection and `connection.ready`;
- typed gateway broadcast behavior; and
- production-style startup and graceful shutdown.

Run strict TypeScript checks across both applications:

```bash
pnpm typecheck
```

Build both production applications:

```bash
pnpm build
```

A complete pre-commit verification is:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Run the compiled server

Build the server package:

```bash
pnpm build:server
```

Then run its compiled CLI from the server package:

```bash
pnpm --filter ./apps/server start
```

Compiled files are written to `apps/server/dist`. The stable `apps/server/bin/eventdeck.js` executable imports the compiled CLI, so published installations do not run TypeScript source directly.

## Test the npm package locally

Create an installable archive:

```bash
pnpm build:server
cd apps/server
npm pack
```

Install the generated archive globally and run it:

```bash
npm install -g ./eventdeck-1.0.0.tgz
eventdeck
```

Verify `/health`, `/api/status`, and the web connection as described above. When finished:

```bash
npm uninstall -g eventdeck
```

## Adding an infrastructure HTTP route

For a new non-domain infrastructure endpoint:

1. Define any Zod request schema under `src/api/schemas`.
2. Keep transport parsing and response mapping in the API layer.
3. Pass validated data to an application service rather than placing business logic in the handler.
4. Add the route registration beneath `src/api/routes`.
5. Register it from `src/api/routes/index.ts`.
6. Add an `app.inject()` API test.

Domain endpoints should be placed inside the relevant feature module rather than growing a single global routes directory indefinitely.

## Publishing a realtime event

Application code should depend on the `WebSocketGateway` interface. It can publish a realtime update without knowing about socket instances:

```ts
gateway.broadcast('server.status_changed', { status: 'ready' })
```

The concrete gateway adds `version` and `timestamp`, serializes the envelope once, and sends it to open clients. Use `sendToClient` only when an event is intentionally scoped to one registered client.

Do not log high-volume or potentially sensitive payloads by default.

## Troubleshooting

### The server reports that the port is already in use

Another process is listening on port `4732`. Stop that process or choose another port:

```bash
EVENTDECK_PORT=5000 pnpm dev:server
VITE_EVENTDECK_WEBSOCKET_URL=ws://127.0.0.1:5000/ws pnpm dev:web
```

### The web page remains disconnected

Confirm all of the following:

- the server terminal says it is ready;
- the web endpoint includes `/ws`;
- server and web ports match;
- `curl http://127.0.0.1:4732/health` succeeds; and
- the browser console does not show mixed-content or connection errors.

The web client reconnects every two seconds, so a page refresh is normally unnecessary after restarting the server.

### SQLite cannot open the database

Check that the configured parent location is writable and that `EVENTDECK_DB_PATH` points to a file rather than an existing directory. For diagnosis, use a known writable temporary path:

```bash
EVENTDECK_DB_PATH=/tmp/eventdeck-diagnostic.db pnpm dev:server
```

Do not point automated tests at the user's real EventDeck database.

### Native `better-sqlite3` installation fails

Use a supported Node.js release, confirm system compiler/build tools are installed, and rerun `pnpm install`. Avoid copying `node_modules` between operating systems or Node.js major versions because native binaries are platform-specific.

### Configuration validation fails

Review the startup error and verify that:

- the port is an integer in the valid range;
- the database path is non-empty; and
- the log level is one of the supported values listed above.

### Tests pass but the production CLI fails

Rebuild the server so `dist` matches the current source:

```bash
pnpm build:server
pnpm --filter ./apps/server start
```

## Fresh-machine validation checklist

After setting up a new machine, confirm:

1. `node --version` reports Node.js 20 or newer.
2. `pnpm --version` reports pnpm 10.x.
3. `pnpm install` finishes, including the `better-sqlite3` install step.
4. `pnpm typecheck` succeeds.
5. `pnpm test` succeeds without touching the real database.
6. `pnpm build` produces both `apps/server/dist` and `apps/web/dist`.
7. `pnpm dev:server` prints the ready addresses.
8. `/health` returns `{ "status": "ok" }`.
9. `/api/status` reports the database as connected.
10. A WebSocket client receives `connection.ready` from `/ws`.
11. `pnpm dev:web` displays `Connected with EventDeck`.
12. `Ctrl+C` shuts down the server without an unhandled error.

Once these checks pass, the server foundation is ready for independently scoped feature modules and migrations.
