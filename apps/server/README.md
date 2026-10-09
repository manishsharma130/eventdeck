# EventDeck

EventDeck is a local companion server for the EventDeck web application. It provides the HTTP API, WebSocket connection, SQLite storage, and Android Debug Bridge (ADB) integration used to inspect and validate analytics events.

The server listens only on the local computer by default. The EventDeck web application can be hosted separately on GitHub Pages while communicating with this locally installed service.

## Requirements

- Node.js 20 or newer
- npm
- ADB available on `PATH` when using Android device and live-stream features

## Install

Install EventDeck globally from npm:

```bash
npm install --global eventdeck
```

## Start the server

```bash
eventdeck start
```

The server starts with these defaults:

```text
HTTP:      http://127.0.0.1:4732
WebSocket: ws://127.0.0.1:4732/ws
Database:  ~/.eventdeck/eventdeck.db
```

Keep the terminal open while using the EventDeck web application. Press `Ctrl+C` to stop the server safely.

## CLI commands

```bash
eventdeck start
eventdeck --help
eventdeck --version
```

Running `eventdeck` without a command also starts the server.

## Verify the installation

With the server running, open another terminal:

```bash
curl http://127.0.0.1:4732/health
```

The expected response is:

```json
{"status":"ok"}
```

## Configuration

EventDeck can be configured with environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `EVENTDECK_HOST` | `127.0.0.1` | Address on which the server listens |
| `EVENTDECK_PORT` | `4732` | HTTP and WebSocket port |
| `EVENTDECK_DB_PATH` | `~/.eventdeck/eventdeck.db` | SQLite database location |
| `EVENTDECK_LOG_LEVEL` | `info` | Logging level |

Example:

```bash
EVENTDECK_PORT=5000 eventdeck start
```

If the port is changed, the web application must be built or configured to use the same HTTP and WebSocket port.

## Security

EventDeck binds to `127.0.0.1` by default, so it is not exposed to other computers on the local network. Browser access is restricted to the official EventDeck GitHub Pages origin and the documented local development origins.

Avoid changing `EVENTDECK_HOST` to `0.0.0.0` unless you understand the network exposure and protect the service appropriately.

## Uninstall

```bash
npm uninstall --global eventdeck
```

Uninstalling the package does not automatically delete the SQLite database under `~/.eventdeck`.

## Source and issues

- [Source code](https://github.com/manishsharma130/eventdeck)
- [Issue tracker](https://github.com/manishsharma130/eventdeck/issues)

## License

EventDeck is open-source software released under the [MIT License](./LICENSE).
