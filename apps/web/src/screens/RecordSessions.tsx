import { useEffect } from 'react'
import { ArrowLeft, FileText, Search, Trash2 } from 'lucide-react'
import { Button, CopyButton, EmptyState, IconButton, Input, Modal, PageHeader, TagBadge } from '../components/ui'
import { api, type RecordedSession } from '../services/api'
import { useLiveStreamStore } from '../state/live-stream-store'
import { useTabState } from '../state/tab-ui-store'
import { VirtualList } from '../components/VirtualList'
import { VirtualGrid } from '../components/VirtualGrid'

type SessionDetails = Awaited<ReturnType<typeof api.recording>>

export function RecordSessions() {
  const [sessions, setSessions] = useTabState<RecordedSession[]>('recordings', 'sessions', [])
  const [query, setQuery] = useTabState('recordings', 'query', '')
  const [checked, setChecked] = useTabState<string[]>('recordings', 'checked', [])
  const [selectedId, setSelectedId] = useTabState<string | null>('recordings', 'selectedId', null)
  const [details, setDetails] = useTabState<SessionDetails | null>('recordings', 'details', null)
  const [pendingDelete, setPendingDelete] = useTabState<string[] | null>('recordings', 'pendingDelete', null)
  const [busy, setBusy] = useTabState('recordings', 'busy', false)
  const [loading, setLoading] = useTabState('recordings', 'loading', true)
  const [error, setError] = useTabState('recordings', 'error', '')
  const [revision, setRevision] = useTabState('recordings', 'revision', 0)
  const [expandedEventIds, setExpandedEventIds] = useTabState<string[]>('recordings', 'expandedEventIds', [])
  const recordingId = useLiveStreamStore((state) => state.runtime.recordingSessionId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void api.recordings().then((items) => {
      if (cancelled) return
      setSessions(items)
      setChecked((current) => current.filter((id) => items.some((item) => item.id === id)))
    }).catch((cause: Error) => { if (!cancelled) setError(cause.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [recordingId, revision])

  useEffect(() => {
    let cancelled = false
    setDetails(null)
    if (selectedId) void api.recording(selectedId).then((session) => {
      if (!cancelled) setDetails(session)
    }).catch((cause: Error) => { if (!cancelled) setError(cause.message) })
    return () => { cancelled = true }
  }, [selectedId, recordingId, revision])

  const visible = sessions.filter((session) => `${session.name} ${session.deviceId}`.toLowerCase().includes(query.trim().toLowerCase()))
  const deletable = sessions.filter((session) => session.id !== recordingId)
  const visibleIds = visible.filter((session) => session.id !== recordingId).map((session) => session.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => checked.includes(id))
  const remove = async () => {
    if (!pendingDelete || busy) return
    setBusy(true)
    setError('')
    try {
      await api.deleteRecordings(pendingDelete)
      setSessions((current) => current.filter((session) => !pendingDelete.includes(session.id)))
      setChecked((current) => current.filter((id) => !pendingDelete.includes(id)))
      if (selectedId && pendingDelete.includes(selectedId)) setSelectedId(null)
      setPendingDelete(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete sessions.') }
    finally { setBusy(false) }
  }

  return <div className="screen recordings-screen">
    <PageHeader title="Recorded Sessions" description="Browse saved sessions and inspect their recorded events." />
    {error && !pendingDelete && <div className="empty-list" role="alert">{error}<Button onClick={() => setRevision((value) => value + 1)}>Retry</Button></div>}
    {selectedId ? <>
      <div className="toolbar"><Button onClick={() => { setSelectedId(null); setError('') }}><ArrowLeft size={18} />All sessions</Button><Button onClick={() => setRevision((value) => value + 1)}>Refresh</Button></div>
      {details ? <section className="panel recording-detail recording-detail-layout" tabIndex={0} aria-label="Recorded session events">
        <div className="panel-title"><div><h2>{details.name}</h2><p>{details.events.length} events · {details.deviceId} · {new Date(details.startedAt).toLocaleString()}</p></div><TagBadge tone={details.status === 'RECORDING' ? 'green' : 'muted'}>{details.status === 'RECORDING' ? 'Recording' : 'Saved'}</TagBadge></div>
        {details.events.length ? <VirtualList className="recorded-event-list" items={details.events} estimateSize={62} getKey={(record) => record.id} renderItem={(record) => <details className="recorded-event" open={expandedEventIds.includes(record.id)} onToggle={(event) => { const open = event.currentTarget.open; setExpandedEventIds((current) => open ? current.includes(record.id) ? current : [...current, record.id] : current.filter((id) => id !== record.id)) }}>
          <summary><span className="sequence">{String(record.sequence + 1).padStart(3, '0')}</span><strong>{record.event.eventName}</strong><span>{record.event.eventTag}</span><small>{record.event.timestamp ?? new Date(record.receivedAt).toLocaleTimeString()}</small></summary>
          <div className="json-head"><h3>Event JSON</h3><CopyButton text={JSON.stringify(record.event, null, 2)} /></div>
          <pre className="json-view"><code>{JSON.stringify(record.event, null, 2)}</code></pre>
        </details>} /> : <EmptyState title="No recorded events" description="This session does not contain any events yet." />}
      </section> : !error && <EmptyState title="Loading recorded events…" />}
    </> : <>
      <div className="recordings-toolbar">
        <label className="search-field"><Search size={19} /><Input aria-label="Search recorded sessions" placeholder="Search sessions by name or device…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="toolbar">
          <Button disabled={!visibleIds.length || loading} onClick={() => setChecked((current) => allSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])])}>{allSelected ? 'Deselect all' : 'Select all'}{query.trim() ? ' results' : ''}</Button>
          <Button disabled={!checked.length || loading} onClick={() => setPendingDelete(checked)}><Trash2 size={17} />Delete selected{checked.length ? ` (${checked.length})` : ''}</Button>
          <Button disabled={!deletable.length || loading} onClick={() => setPendingDelete(deletable.map((session) => session.id))}>Delete all</Button>
        </div>
      </div>
      {loading ? <EmptyState title="Loading sessions…" /> : <>
        <p className="recording-count">{visible.length} {visible.length === 1 ? 'session' : 'sessions'}{recordingId && ' · Stop and save the active recording before deleting it.'}</p>
        <VirtualGrid className="recording-grid" items={visible} minColumnWidth={270} estimateRowSize={245} getKey={(session) => session.id} renderItem={(session) => <article className={`panel recording-card ${checked.includes(session.id) ? 'selected' : ''}`}>
          <div className="recording-card-actions"><input type="checkbox" aria-label={`Select ${session.name}`} disabled={session.id === recordingId} checked={checked.includes(session.id)} onChange={() => setChecked((current) => current.includes(session.id) ? current.filter((id) => id !== session.id) : [...current, session.id])} /><TagBadge tone={session.status === 'RECORDING' ? 'green' : 'muted'}>{session.status === 'RECORDING' ? 'Recording' : 'Saved'}</TagBadge><IconButton label={`Delete ${session.name}`} disabled={session.id === recordingId} onClick={() => setPendingDelete([session.id])}><Trash2 size={18} /></IconButton></div>
          <button className="recording-card-open" onClick={() => { setError(''); setSelectedId(session.id) }}><FileText size={26} /><h2>{session.name}</h2><span>{session.totalEvents} events · {session.deviceId}</span><small>{new Date(session.startedAt).toLocaleString()}</small><strong>View events →</strong></button>
        </article>} />
        {!visible.length && !error && <EmptyState title={query.trim() ? 'No matching sessions' : 'No recorded sessions yet'} description={query.trim() ? 'Try another session name or device.' : 'Start a recording in Live Stream, then stop and save it to review the events here.'} />}
      </>}
    </>}
    {pendingDelete && <Modal title="Delete recorded sessions?" onClose={() => { if (!busy) setPendingDelete(null) }} actions={<><Button disabled={busy} onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete'}</Button></>}><p>This will permanently delete {pendingDelete.length} {pendingDelete.length === 1 ? 'session' : 'sessions'} and all their recorded events.</p>{error && <p role="alert">{error}</p>}</Modal>}
  </div>
}
