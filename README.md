# EventDeck

**Stream. Validate. Debug.**

EventDeck is a local event debugging and validation workspace for Android developers. It streams tagged JSON messages from ADB Logcat into a virtualized React interface, records sessions to disk, and validates expected event flows.

## Requirements

- Node.js 20 or newer
- Android platform tools (`adb`) on your PATH

## Run locally

```bash
npm install
npm run build
npm start
```

The server binds to `127.0.0.1:3000` and stores data in `~/.eventdeck`. Useful options:

```bash
eventdeck --port 4000 --tag AnalyticsEvent --no-open
```

Send JSON from Android using the selected tag, for example:

```kotlin
Log.d(
    "AnalyticsEvent",
    """{"eventName":"purchase","eventParams":{"product_id":"P1001","price":999},"eventTag":"google_analytics"}"""
)
```

## Development

Run `npm run dev` for the backend and `npm run dev:web` for the Vite frontend. The frontend development server proxies API and WebSocket traffic to port 3000.
