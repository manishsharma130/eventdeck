import { useEffect, useState } from 'react'
import { AppShell, type TabId } from './components/ui'
import { EventDeckWebSocket, type ConnectionStatus } from './services/websocket'
import { Settings } from './screens/Settings'
import { LiveStream } from './screens/LiveStream'
import { RecordSessions } from './screens/RecordSessions'
import { EventRules } from './screens/EventRules'
import { BuildFlow } from './screens/BuildFlow'
import { FlowExecution } from './screens/FlowExecution'
import { DisconnectedScreen, LoadingScreen } from './screens/Startup'
import { api } from './services/api'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useLiveStreamStore } from './state/live-stream-store'
import { ScrollRestorationBoundary } from './components/ScrollRestorationBoundary'

type ViewOverride = TabId | 'loading' | 'disconnected' | null
const tabPaths: Record<TabId, string> = { live: '/live-stream', rules: '/event-rules', build: '/build-flow', execution: '/flow-execution', recordings: '/record-sessions', settings: '/settings' }
const pathTabs = Object.fromEntries(Object.entries(tabPaths).map(([tab, path]) => [path, tab])) as Record<string, TabId>

function getViewOverride(): ViewOverride {
  const value = new URLSearchParams(window.location.search).get('view')
  return ['live', 'rules', 'build', 'execution', 'recordings', 'settings', 'loading', 'disconnected'].includes(value ?? '') ? value as ViewOverride : null
}

export function App() {
  const override = getViewOverride()
  const location = useLocation()
  const navigate = useNavigate()
  const routeTab = pathTabs[location.pathname]
  const initialTab = override && ['live', 'rules', 'build', 'execution', 'recordings', 'settings'].includes(override) ? override as TabId : routeTab ?? 'live'
  const [connection, setConnection] = useState<ConnectionStatus>(override && !['loading', 'disconnected'].includes(override) ? 'connected' : 'connecting')
  const [client, setClient] = useState<EventDeckWebSocket | null>(null)

  useEffect(() => {
    if (override) return
    let disposed = false
    let socket: EventDeckWebSocket | undefined
    let unsubscribe: (() => void) | undefined
    let retryTimer: number | undefined
    const connect = () => {
      void api.health().then(() => {
        if (disposed) return
        socket = new EventDeckWebSocket(setConnection)
        unsubscribe = socket.subscribe((message) => useLiveStreamStore.getState().handleMessage(message))
        setClient(socket)
        socket.connect()
      }).catch(() => { if (disposed) return; setConnection('disconnected'); retryTimer = window.setTimeout(connect, 2500) })
    }
    const splashTimer = window.setTimeout(connect, 1500)
    return () => { disposed = true; window.clearTimeout(splashTimer); if (retryTimer) window.clearTimeout(retryTimer); unsubscribe?.(); socket?.disconnect() }
  }, [override])

  useEffect(() => {
    if (override) return
    if (!routeTab) navigate(tabPaths.live, { replace: true })
  }, [navigate, override, routeTab])

  if (override === 'loading' || (!override && connection === 'connecting')) return <LoadingScreen />
  if (override === 'disconnected' || (!override && connection === 'disconnected')) return <DisconnectedScreen />

  const tab = initialTab
  const navigateToTab = (next: TabId) => navigate(tabPaths[next])

  return (
    <AppShell active={tab} onNavigate={navigateToTab}>
      <ScrollRestorationBoundary tab={tab}>{override && ['live', 'rules', 'build', 'execution', 'recordings', 'settings'].includes(override) ? (
        override === 'settings' ? <Settings /> : override === 'recordings' ? <RecordSessions /> : override === 'live' ? <LiveStream /> : override === 'rules' ? <EventRules /> : override === 'build' ? <BuildFlow /> : <FlowExecution websocket={client} />
      ) : <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/live-stream" element={<LiveStream />} />
        <Route path="/record-sessions" element={<RecordSessions />} />
        <Route path="/event-rules" element={<EventRules />} />
        <Route path="/build-flow" element={<BuildFlow />} />
        <Route path="/flow-execution" element={<FlowExecution websocket={client} />} />
        <Route path="*" element={<Navigate to="/live-stream" replace />} />
      </Routes>}</ScrollRestorationBoundary>
    </AppShell>
  )
}
