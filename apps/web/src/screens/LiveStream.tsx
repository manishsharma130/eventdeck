import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Circle, MoreVertical, Pause, Play, Search, Square, Trash2, X } from 'lucide-react'
import { Button, CopyButton, IconButton, Input, Modal, Select, TagBadge } from '../components/ui'
import { api } from '../services/api'
import { useLiveStreamStore, type StreamEvent } from '../state/live-stream-store'
import { useTabState } from '../state/tab-ui-store'

const tones = { 'Firebase Analytics': 'blue', firebase_analytics: 'blue', Firebase: 'blue', 'Google Analytics': 'green', google_analytics: 'green', MoEngage: 'purple', moengage: 'purple' } as const
const defaultTags = [
  { value: 'google_analytics', label: 'Google Analytics' },
  { value: 'firebase_analytics', label: 'Firebase Analytics' },
  { value: 'moengage', label: 'MoEngage' },
]
type AnalyticsEvent = StreamEvent

function EventRow({ event, selected, onSelect }: { event: AnalyticsEvent; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`event-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="sequence">{String(event.sequence).padStart(3, '0')}</span>
      <span className="event-main"><strong>{event.name}</strong><small>{event.timestamp}</small></span>
      <TagBadge tone={tones[event.tag as keyof typeof tones] ?? 'muted'}>{event.tag}</TagBadge>
      <MoreVertical size={18} />
    </button>
  )
}

export function LiveStream() {
  const [saveModal, setSaveModal] = useTabState('live', 'saveModal', false)
  const [sessionName, setSessionName] = useTabState('live', 'sessionName', '')
  const [deviceRequired, setDeviceRequired] = useTabState('live', 'deviceRequired', false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const runtime = useLiveStreamStore((state) => state.runtime)
  const visibleEvents = useLiveStreamStore((state) => state.events)
  const selectedEventId = useLiveStreamStore((state) => state.selectedEventId)
  const query = useLiveStreamStore((state) => state.query)
  const tag = useLiveStreamStore((state) => state.tag)
  const error = useLiveStreamStore((state) => state.error)
  const notice = useLiveStreamStore((state) => state.notice)
  const setRuntime = useLiveStreamStore((state) => state.setRuntime)
  const setSelectedEvent = useLiveStreamStore((state) => state.setSelectedEvent)
  const setQuery = useLiveStreamStore((state) => state.setQuery)
  const setTag = useLiveStreamStore((state) => state.setTag)
  const setError = useLiveStreamStore((state) => state.setError)
  const setNotice = useLiveStreamStore((state) => state.setNotice)
  const clearEvents = useLiveStreamStore((state) => state.clearEvents)
  const hydrate = useLiveStreamStore((state) => state.hydrate)
  const selected = visibleEvents.find((event) => event.id === selectedEventId) ?? null
  const streamState = runtime.streamState === 'PLAYING' ? 'running' : runtime.streamState === 'PAUSED' ? 'paused' : 'stopped'
  const recording = runtime.isRecording
  const selectedDeviceId = runtime.selectedDeviceId

  const filtered = useMemo(() => visibleEvents.filter((event) => {
    const search = query.toLowerCase()
    const matchesQuery = event.name.toLowerCase().includes(search) || JSON.stringify(event.params).toLowerCase().includes(search)
    return matchesQuery && (tag === 'All Tags' || event.tag === tag)
  }), [query, tag, visibleEvents])
  const hasActiveFilter = Boolean(query.trim()) || tag !== 'All Tags'

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 55,
    overscan: 8,
  })

  const tags = useMemo(() => {
    const defaults = new Set(defaultTags.map((item) => item.value))
    return [...defaultTags, ...[...new Set(visibleEvents.map((event) => event.tag))].filter((value) => !defaults.has(value)).map((value) => ({ value, label: value }))]
  }, [visibleEvents])
  const json = selected ? JSON.stringify({ eventName: selected.name, eventTag: selected.tag, timestamp: selected.timestamp, eventParams: selected.params }, null, 2) : '{}'
  const command = async (action: 'play' | 'pause' | 'stop') => { try { setError(''); setRuntime(await api.stream(action)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Stream command failed.') } }
  const toggleStream = async () => {
    let action: 'play' | 'pause' = streamState === 'running' ? 'pause' : 'play'
    if (!selectedDeviceId) {
      try {
        const state = await api.runtime()
        setRuntime(state)
        if (!state.selectedDeviceId) { setDeviceRequired(true); return }
        action = state.streamState === 'PLAYING' ? 'pause' : 'play'
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not read Live Stream state.')
        return
      }
    }
    await command(action)
  }
  const toggleRecording = async () => {
    if (recording) { setSaveModal(true); return }
    try { await api.startRecording(`Session ${new Date().toLocaleString()}`); setRuntime(await api.runtime()); setNotice('Recording started.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start recording.') }
  }

  useEffect(() => { void hydrate() }, [hydrate])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer) }, [notice])

  return (
    <div className="screen live-screen">
      <div className="live-top-view">
        <div className="page-header live-page-header"><h1>Live Stream</h1><p>Monitor real-time events from your app as they happen.</p></div>
        <section className="stream-controls-panel" aria-label="Stream Controls">
          <span className="stream-controls-title">Stream Controls</span>
          <div className="stream-control-items">
            <button className="stream-control-item primary" onClick={() => void toggleStream()}>
              <span>{streamState === 'running' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span>
              <strong>{streamState === 'running' ? 'Pause' : 'Play'}</strong>
            </button>
            <button className="stream-control-item" disabled={streamState === 'stopped'} onClick={() => void command('stop')}><span><Square fill="currentColor" /></span><strong>Stop</strong></button>
            <button className="stream-control-item" onClick={clearEvents}><span><Trash2 /></span><strong>Clear</strong></button>
            <i className="stream-control-divider" />
            <button className="stream-control-item record" disabled={!selectedDeviceId} onClick={() => void toggleRecording()}><span><Circle fill={recording ? 'var(--danger)' : 'none'} /></span><strong>{recording ? 'Stop Session' : 'Record Session'}</strong></button>
          </div>
        </section>
      </div>
      <div className="live-gradient-divider" />
      <div className="live-bottom-view">
        {error && <div className="empty-list" role="alert">{error}</div>}
        {notice && <div className="app-toast" role="status">{notice}</div>}
        <div className="live-filter-row">
          <div className="live-filters">
            <label className="search-field"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by event name..." /></label>
            <Select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="All Tags">All Tags</option>{tags.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </div>
          <div className="event-count" aria-label={`${visibleEvents.length} total events${hasActiveFilter ? `, ${filtered.length} matching events` : ''}, ${streamState === 'running' ? 'streaming' : streamState}`}>
            <span className={`dot ${streamState === 'running' ? 'success' : ''}`} />
            <span><strong>{visibleEvents.length}</strong> total events</span>
            {hasActiveFilter && <><i /><span><strong>{filtered.length}</strong> {query.trim() ? 'search results' : 'filtered events'}</span></>}
            <span>· {streamState === 'running' ? 'streaming' : streamState}</span>
          </div>
        </div>
        <div className={`live-grid ${selected ? 'details-open' : 'details-closed'}`}>
          <div className="event-list" ref={scrollRef}>
            {filtered.length === 0 ? <div className="empty-list">{hasActiveFilter && visibleEvents.length ? 'No matching events.' : 'Waiting for events...'}</div> : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const event = filtered[item.index]
                  return <div key={event.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}><EventRow event={event} selected={selected?.id === event.id} onSelect={() => setSelectedEvent(event.id)} /></div>
                })}
              </div>
            )}
          </div>
          {selected && <section className="panel event-details">
            <div className="panel-title"><h2>Event Details</h2><IconButton label="Close details" bare onClick={() => setSelectedEvent(null)}><X size={19} /></IconButton></div>
            <><dl className="details-list"><dt>Event Name</dt><dd>{selected.name}</dd></dl>
            <div className="json-head"><h3>Event JSON</h3><CopyButton text={json} /></div>
            <pre className="json-view"><code>{json}</code></pre></>
          </section>}
        </div>
      </div>
      {saveModal && <Modal title="Save recorded session?" onClose={() => setSaveModal(false)} actions={<><Button onClick={() => setSaveModal(false)}>Cancel</Button><Button variant="primary" disabled={!sessionName.trim()} onClick={() => void api.stopRecording(sessionName).then(async () => { setRuntime(await api.runtime()); setSaveModal(false); setSessionName(''); setNotice('Recording saved.') }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not save recording.'))}>Save</Button></>}>
        <label className="field-label">Session name<Input autoFocus value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Enter a session name..." /></label>
      </Modal>}
      {deviceRequired && <Modal title="Device required" onClose={() => setDeviceRequired(false)} actions={<Button variant="primary" onClick={() => setDeviceRequired(false)}>OK</Button>}><p>Please select the device in order to select the stream.</p></Modal>}
    </div>
  )
}
