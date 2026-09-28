# EventDeck

EventDeck is a local event-development tool built as a pnpm monorepo. Its current foundation contains:

- a **React web application** that shows whether EventDeck is available; and
- a **local Node.js server**, published as the `eventdeck` npm package, with Fastify HTTP, WebSocket, and SQLite foundations.

The browser connects to `ws://127.0.0.1:4732/ws` and receives a versioned `connection.ready` event. The server also exposes health/status endpoints and initializes a configurable local SQLite database. No EventDeck domain tables or feature behavior are included yet.

## Index

- [Quick start](#quick-start)
- [What should I see?](#what-should-i-see)
- [Common commands](#common-commands)
- [Detailed server foundation setup](docs/server-foundation-setup.md)
  - [Configuration](docs/server-foundation-setup.md#environment-variables)
  - [HTTP and WebSocket verification](docs/server-foundation-setup.md#verify-the-http-api)
  - [SQLite and migrations](docs/server-foundation-setup.md#sqlite-initialization)
  - [Testing and troubleshooting](docs/server-foundation-setup.md#run-automated-checks)
- [Architecture](docs/architecture.md)
  - [Architecture overview](docs/architecture.md#architecture-overview)
  - [Application layers](docs/architecture.md#application-layers)
  - [Runtime communication](docs/architecture.md#runtime-communication)
  - [Why this architecture?](docs/architecture.md#why-this-architecture)
- [Project structure and file guide](docs/file-reference.md)
- [Development, builds, and npm packaging](docs/development.md)
- [GitHub Pages deployment](docs/deployment.md)

## Quick start

### Requirements

- Node.js 20 or newer
- pnpm 10.x

Check your installed versions:

```bash
node --version
pnpm --version
```

### 1. Install dependencies

From the repository root:

```bash
pnpm install
```

### 2. Start the local server

In the first terminal:

```bash
pnpm dev:server
```

The server listens on `http://127.0.0.1:4732`, with WebSocket connections at `/ws`.

### 3. Start the web application

In a second terminal:

```bash
pnpm dev:web
```

Open the URL printed by Vite, normally [http://localhost:5173](http://localhost:5173).

## What should I see?

With the server running:

```text
EventDeck

Connected with EventDeck
```

Stop the server with `Ctrl+C`. The page changes automatically to:

```text
Not connected with EventDeck
```

The client retries every two seconds, so restarting the server restores the connection without refreshing the page.

To verify the WebSocket handshake, open the browser developer console and look for:

```text
WebSocket connected
EventDeck event: {"type":"connection.ready",...}
```

## Common commands

```bash
# Install all workspace dependencies
pnpm install

# Start each application in development mode
pnpm dev:server
pnpm dev:web

# Type-check both applications
pnpm typecheck

# Run server tests
pnpm test:server

# Build both applications
pnpm build

# Build one application
pnpm build:web
pnpm build:server
```

Build output is written to `apps/web/dist` and `apps/server/dist`.

## Documentation

- **[Server foundation setup](docs/server-foundation-setup.md)** is the detailed setup and operations guide, including prerequisites, configuration, startup, API/WebSocket verification, SQLite migrations, testing, extension patterns, and troubleshooting.
- **[Architecture](docs/architecture.md)** explains the monorepo, application boundaries, WebSocket lifecycle, build paths, and the reasons behind the design.
- **[File reference](docs/file-reference.md)** describes the repository structure and responsibility of every project-owned file.
- **[Development guide](docs/development.md)** covers configuration, type-checking, builds, local npm-package testing, and publishing.
- **[Deployment guide](docs/deployment.md)** explains the GitHub Pages workflow and the HTTPS-to-local-WebSocket limitation.
