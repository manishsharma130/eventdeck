import { readFileSync } from 'node:fs'
import { cliHelp, parseCliArguments } from './cli-options.js'
import { startServer } from './server/start-server.js'

const action = (() => {
  try {
    return parseCliArguments(process.argv.slice(2))
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${cliHelp}`)
    process.exit(1)
  }
})()

if (action === 'help') {
  console.log(cliHelp)
  process.exit(0)
}

if (action === 'version') {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  console.log(packageJson.version)
  process.exit(0)
}

let runtime: Awaited<ReturnType<typeof startServer>> | undefined

try {
  runtime = await startServer()
  const address = runtime.app.server.address()
  const port = typeof address === 'object' && address ? address.port : runtime.config.port
  console.log(`\nEventDeck\n\n✓ Local server started\n✓ HTTP ready at http://${runtime.config.host}:${port}\n✓ WebSocket ready at ws://${runtime.config.host}:${port}/ws\n\nPress Ctrl+C to stop.`)
} catch (error) {
  console.error(`Unable to start EventDeck: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\nStopping EventDeck...')
  await runtime?.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
