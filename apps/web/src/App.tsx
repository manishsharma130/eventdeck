import { useEffect, useState } from 'react'
import { AppShell, type TabId } from './components/ui'
import { EventDeckWebSocket, type ConnectionStatus } from './services/websocket'
import { LiveStream } from './screens/LiveStream'
import { EventRules } from './screens/EventRules'
import { BuildFlow } from './screens/BuildFlow'
import { FlowExecution } from './screens/FlowExecution'
import { DisconnectedScreen, LoadingScreen } from './screens/Startup'

type ViewOverride = TabId | 'loading' | 'disconnected' | null

function getViewOverride(): ViewOverride {
  const value = new URLSearchParams(window.location.search).get('view')
  return ['live', 'rules', 'build', 'execution', 'loading', 'disconnected'].includes(value ?? '') ? value as ViewOverride : null
}

export function App() {
  const override = getViewOverride()
  const [connection, setConnection] = useState<ConnectionStatus>(override && !['loading', 'disconnected'].includes(override) ? 'connected' : 'connecting')
  const [tab, setTab] = useState<TabId>(override && ['live', 'rules', 'build', 'execution'].includes(override) ? override as TabId : 'live')
  const [streaming, setStreaming] = useState(true)

  useEffect(() => {
    if (override) return
    let client: EventDeckWebSocket | undefined
    const splashTimer = window.setTimeout(() => {
      client = new EventDeckWebSocket(setConnection)
      client.connect()
    }, 1500)
    return () => { window.clearTimeout(splashTimer); client?.disconnect() }
  }, [override])

  if (override === 'loading' || (!override && connection === 'connecting')) return <LoadingScreen />
  if (override === 'disconnected' || (!override && connection === 'disconnected')) return <DisconnectedScreen />

  return (
    <AppShell active={tab} onNavigate={setTab} streaming={streaming} onStreamingChange={setStreaming}>
      {tab === 'live' && <LiveStream />}
      {tab === 'rules' && <EventRules />}
      {tab === 'build' && <BuildFlow />}
      {tab === 'execution' && <FlowExecution />}
    </AppShell>
  )
}
