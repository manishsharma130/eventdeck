import { useEffect, useState } from 'react'
import { EventDeckWebSocket, type ConnectionStatus } from './services/websocket'

const labels: Record<ConnectionStatus, string> = {
  connecting: 'Connecting with EventDeck...',
  connected: 'Connected with EventDeck',
  disconnected: 'Not connected with EventDeck',
}

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    const client = new EventDeckWebSocket(setStatus)
    client.connect()
    return () => client.disconnect()
  }, [])

  return (
    <main>
      <h1>EventDeck</h1>
      <p className={status} role="status" aria-live="polite">
        <span aria-hidden="true" />
        {labels[status]}
      </p>
    </main>
  )
}
