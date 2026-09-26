# Development and npm packaging

[← Back to README](../README.md) · [Architecture](architecture.md) · [File reference](file-reference.md) · [Deployment](deployment.md)

## Requirements

- Node.js 20 or newer
- pnpm 11 or newer

## Install dependencies

From the repository root:

```bash
pnpm install
```

The command installs dependencies for all workspace packages using `pnpm-lock.yaml`.

## Run locally

Use two terminals because the web application and server are separate processes.

Terminal 1:

```bash
pnpm dev:server
```

Terminal 2:

```bash
pnpm dev:web
```

Open the Vite URL, normally `http://localhost:5173`. The page reports whether the server at `ws://127.0.0.1:4732` is reachable.

## Verify connection and echo behavior

With both processes running, the page displays `Connected with EventDeck`. Open the browser developer console and confirm:

```text
WebSocket connected
Echo response: Hello EventDeck
```

Stop the server with `Ctrl+C`. The page changes to `Not connected with EventDeck`. Restarting the server should restore the connection without a page refresh.

## Environment configuration

The web client defaults to `ws://127.0.0.1:4732`. Override it for development or a build with:

```bash
VITE_EVENTDECK_WEBSOCKET_URL=ws://127.0.0.1:5000 pnpm dev:web
```

The server currently uses the fixed, centralized port `4732`.

## Type-check

Check both workspace applications:

```bash
pnpm typecheck
```

## Build

Build everything:

```bash
pnpm build
```

Build only the web application:

```bash
pnpm build:web
```

Output: `apps/web/dist`

Build only the server:

```bash
pnpm build:server
```

Output: `apps/server/dist`

The npm CLI runs the compiled JavaScript from `dist`; it does not execute TypeScript source in production.

## Test the npm package locally

Build and create an npm archive:

```bash
pnpm build:server
cd apps/server
npm pack
```

This creates a file such as `eventdeck-1.0.0.tgz`. Install and run it globally:

```bash
npm install -g ./eventdeck-1.0.0.tgz
eventdeck
```

Start the web application from the repository root and confirm that it connects to the installed server:

```bash
pnpm dev:web
```

After testing, stop the server and uninstall the package:

```bash
npm uninstall -g eventdeck
```

## Publish the server package

Publishing is manual and is not part of the normal build or GitHub Pages workflow:

```bash
cd apps/server
npm login
pnpm build
npm pack
npm publish
```

Once published, users can install and start EventDeck with:

```bash
npm install -g eventdeck
eventdeck
```
