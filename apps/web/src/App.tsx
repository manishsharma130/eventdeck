import { clearTabUiState } from './state/tab-ui-store'
import { useEffect, useRef, useState } from 'react'
import { AppShell, type TabId } from './components/ui'
import { EventDeckWebSocket, type ConnectionStatus } from './services/websocket'
import { Settings } from './screens/Settings'
import { LiveStream } from './screens/LiveStream'
import { RecordSessions } from './screens/RecordSessions'
import { EventRules } from './screens/EventRules'
import { BuildFlow } from './screens/BuildFlow'
import { FlowExecution } from './screens/FlowExecution'
import { DisconnectedScreen, LoadingScreen } from './screens/Startup'
import { api, type StorageOperation } from './services/api'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useLiveStreamStore } from './state/live-stream-store'
import { ScrollRestorationBoundary } from './components/ScrollRestorationBoundary'
import { LoaderCircle } from 'lucide-react'
import { useStorageOperationStore } from './state/storage-operation-store'

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
  const [storageRevision, setStorageRevision] = useState<Record<string, number>>({})
  const [client, setClient] = useState<EventDeckWebSocket | null>(null)
  const storageStatus = useStorageOperationStore(state => state.status)
  const setStorageOperation = useStorageOperationStore(state => state.setOperation)
  const hydrateStorage = useStorageOperationStore(state => state.hydrate)
  const storageRunning = storageStatus?.operation?.status === 'RUNNING'
  const guardUrl = useRef('')

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
        void hydrateStorage()
        unsubscribe = socket.subscribe((message) => {
          if (message.type === 'storage.operation_changed') setStorageOperation(message.payload as StorageOperation)
          if ([
            'live_stream.state_changed',
            'recording.started',
            'recording.stopped',
            'flow_execution.started',
            'flow_execution.validation_completed',
          ].includes(message.type)) void hydrateStorage()
          if (message.type === 'storage.cleared') {
            const { affected } = message.payload as { affected: string[] }
            clearTabUiState(affected)
            window.dispatchEvent(new Event('eventdeck:storage-cleared'))
            setStorageRevision(revisions => {
              const updated = { ...revisions }
              for (const tab of affected) updated[tab] = (updated[tab] ?? 0) + 1
              return updated
            })
          }
          useLiveStreamStore.getState().handleMessage(message)
        })
        setClient(socket)
        socket.connect()
      }).catch(() => { if (disposed) return; setConnection('disconnected'); retryTimer = window.setTimeout(connect, 2500) })
    }
    const splashTimer = window.setTimeout(connect, 1500)
    return () => { disposed = true; window.clearTimeout(splashTimer); if (retryTimer) window.clearTimeout(retryTimer); unsubscribe?.(); socket?.disconnect() }
  }, [override])

  useEffect(() => {
    if (!storageRunning) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    guardUrl.current = window.location.href
    window.history.pushState({ eventdeckStorageGuard: true }, '', guardUrl.current)
    const popState = () => window.history.pushState({ eventdeckStorageGuard: true }, '', guardUrl.current)
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', popState)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', popState)
      if (window.history.state?.eventdeckStorageGuard) window.history.back()
    }
  }, [storageRunning])

  useEffect(() => {
    if (!storageRunning) return
    const poll = window.setInterval(() => void hydrateStorage(), 750)
    return () => window.clearInterval(poll)
  }, [hydrateStorage, storageRunning])

  useEffect(() => {
    if (override) return
    if (!routeTab) navigate(tabPaths.live, { replace: true })
  }, [navigate, override, routeTab])

  if (override === 'loading' || (!override && connection === 'connecting')) return <LoadingScreen />
  if (override === 'disconnected' || (!override && connection === 'disconnected')) return <DisconnectedScreen />

  const tab = initialTab
  const navigateToTab = (next: TabId) => { if (!storageRunning) navigate(tabPaths[next]) }

  return (
    <>
    <AppShell active={tab} onNavigate={navigateToTab}>
      <ScrollRestorationBoundary key={`${tab}-${storageRevision[tab] ?? 0}`} tab={tab}>{override && ['live', 'rules', 'build', 'execution', 'recordings', 'settings'].includes(override) ? (
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
    {storageRunning && <div className="storage-global-blocker" role="alertdialog" aria-modal="true" aria-labelledby="storage-operation-title">
      <div className="storage-global-card">
        <LoaderCircle size={26} className="storage-spinner" />
        <div><strong id="storage-operation-title">Clearing EventDeck storage</strong><p>Please keep the server running. This page will update when deletion is complete.</p></div>
      </div>
    </div>}
    </>
  )
}
