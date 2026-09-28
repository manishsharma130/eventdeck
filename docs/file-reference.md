# Project structure and file reference

[← Back to README](../README.md) · [Server setup](server-foundation-setup.md) · [Architecture](architecture.md) · [Development guide](development.md) · [Deployment](deployment.md)

## Repository structure

```text
eventdeck/
├── apps/
│   ├── web/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── config/environment.ts
│   │   │   ├── services/websocket.ts
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── styles.css
│   │   │   └── vite-env.d.ts
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── server/
│       ├── bin/eventdeck.js
│       ├── src/
│       │   ├── api/
│       │   ├── config/
│       │   ├── database/
│       │   ├── logging/
│       │   ├── modules/
│       │   ├── server/
│       │   ├── shared/
│       │   ├── websocket/
│       │   ├── cli.ts
│       │   └── index.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   ├── data-management-and-execution.md
│   ├── development.md
│   ├── file-reference.md
│   └── server-foundation-setup.md
├── .github/workflows/deploy-web.yml
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

## Root files

- **`README.md`** — short project landing page, documentation index, quick start, and common commands.
- **`package.json`** — marks the root as private and provides commands for developing, type-checking, and building both applications.
- **`pnpm-workspace.yaml`** — registers `apps/*` as workspace packages and allows the required `esbuild` installation step.
- **`pnpm-lock.yaml`** — records exact dependency versions for reproducible local and CI installations. pnpm generates and maintains it.
- **`.gitignore`** — excludes dependencies, compiled output, TypeScript build metadata, logs, npm archives, and local pnpm data.

## Documentation files

- **`docs/architecture.md`** — explains system layers, runtime communication, delivery flows, design decisions, and future boundaries.
- **`docs/file-reference.md`** — documents the repository structure and every project-owned file.
- **`docs/development.md`** — describes environment configuration, validation, builds, local package testing, and npm publishing.
- **`docs/deployment.md`** — explains the GitHub Pages workflow, production path configuration, and browser security considerations.
- **`docs/data-management-and-execution.md`** — documents the four feature modules, HTTP APIs, realtime messages, persistence, and execution lifecycle.
- **`docs/server-foundation-setup.md`** — provides the detailed server installation, configuration, verification, testing, migration, extension, and troubleshooting guide.

## Web application files

- **`apps/web/package.json`** — defines the private web package, React/Vite dependencies, and its `dev`, `build`, and `typecheck` scripts.
- **`apps/web/index.html`** — provides the browser document and `#root` element where React mounts.
- **`apps/web/vite.config.ts`** — enables React and uses `/eventdeck/` as the production asset base for GitHub Pages. Development uses `/`.
- **`apps/web/tsconfig.json`** — supplies strict browser and React TypeScript settings.
- **`apps/web/public/.gitkeep`** — preserves the empty public-assets directory in Git. Future unprocessed static files can be placed here.
- **`apps/web/src/main.tsx`** — browser entry point that loads global styles and renders the React application.
- **`apps/web/src/App.tsx`** — presentation component that starts the client and displays the current connection state.
- **`apps/web/src/styles.css`** — styles the page and its connecting, connected, and disconnected states.
- **`apps/web/src/config/environment.ts`** — owns the WebSocket endpoint and reads an optional `VITE_EVENTDECK_WEBSOCKET_URL` override.
- **`apps/web/src/services/websocket.ts`** — owns socket creation, event handling, cleanup, and reconnection.
- **`apps/web/src/vite-env.d.ts`** — loads Vite's TypeScript declarations, including `import.meta.env` support.
- **`apps/web/dist/`** — generated static production output. It is created by the build and is not committed.

## Server application files

- **`apps/server/package.json`** — defines the publishable `eventdeck` package, npm metadata, included files, dependencies, scripts, and CLI mapping.
- **`apps/server/tsconfig.json`** — compiles strict Node.js TypeScript from `src` into ESM JavaScript under `dist`.
- **`apps/server/bin/eventdeck.js`** — stable executable entry point with a Node shebang; it loads the compiled CLI.
- **`apps/server/src/cli.ts`** — starts the server, prints status, reports startup failures, and performs graceful `SIGINT`/`SIGTERM` shutdown.
- **`apps/server/src/config/`** — validates environment-driven host, port, database path, and log level configuration.
- **`apps/server/src/database/`** — contains the database port, SQLite adapter, pragmas, and transactional migration runner.
- **`apps/server/src/api/`** — registers health/status routes and the global application error response format.
- **`apps/server/src/websocket/`** — owns client connections, the standard event envelope, direct sends, and broadcasts.
- **`apps/server/src/server/`** — separates dependency-driven Fastify construction from production startup and shutdown.
- **`apps/server/src/logging/`** and **`src/shared/`** — provide structured logging and common infrastructure errors.
- **`apps/server/src/modules/`** — contains the isolated Live Stream, Event Rules, Build Flow, and Flow Execution domain/application/infrastructure/API layers.
- **`apps/server/tests/`** — covers server injection, health/status, temporary SQLite initialization, WebSocket readiness, and broadcasts.
- **`apps/server/dist/`** — generated JavaScript, declarations, and source maps used by the published CLI. It is created by the build and is not committed.

## Automation

- **`.github/workflows/deploy-web.yml`** — installs dependencies, builds only `apps/web`, uploads `apps/web/dist`, and deploys it to GitHub Pages after a push to `main`.
