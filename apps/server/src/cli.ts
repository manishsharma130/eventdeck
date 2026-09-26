import { createServer } from './server.js'
import { WEBSOCKET_URL } from './websocket.js'

const server = createServer()

try {
  await server.start()
  console.log(`\nEventDeck\n\n✓ Local server started\n✓ WebSocket ready\n✓ Listening on ${WEBSOCKET_URL}\n\nPress Ctrl+C to stop.`)
} catch (error) {
  console.error(`Unable to start EventDeck: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\nStopping EventDeck...')
  await server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
