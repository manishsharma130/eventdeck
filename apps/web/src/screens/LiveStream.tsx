import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Circle, MoreVertical, Pause, Play, Search, Square, Trash2, X } from 'lucide-react'
import { events, type AnalyticsEvent } from '../data/mockData'
import { Button, CopyButton, IconButton, Input, Modal, Select, TagBadge } from '../components/ui'

const tones = { 'Firebase Analytics': 'blue', 'Google Analytics': 'green', MoEngage: 'purple' } as const

function EventRow({ event, selected, onSelect }: { event: AnalyticsEvent; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`event-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="sequence">{String(event.id).padStart(3, '0')}</span>
      <span className="event-main"><strong>{event.name}</strong><small>{event.timestamp}</small></span>
      <TagBadge tone={tones[event.tag]}>{event.tag}</TagBadge>
      <MoreVertical size={18} />
    </button>
  )
}

export function LiveStream() {
  const [streamState, setStreamState] = useState<'running' | 'paused' | 'stopped'>('running')
  const [recording, setRecording] = useState(false)
  const [saveModal, setSaveModal] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('All Tags')
  const [selected, setSelected] = useState<AnalyticsEvent>(events[0])
  const [visibleEvents, setVisibleEvents] = useState(events)
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => visibleEvents.filter((event) => {
    const search = query.toLowerCase()
    const matchesQuery = event.name.includes(search) || JSON.stringify(event.params).toLowerCase().includes(search)
    return matchesQuery && (tag === 'All Tags' || event.tag === tag)
  }), [query, tag, visibleEvents])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 55,
    overscan: 8,
  })

  const json = JSON.stringify({ eventName: selected.name, eventTag: selected.tag, timestamp: selected.timestamp, eventParams: selected.params }, null, 2)
  const toggleRecording = () => recording ? setSaveModal(true) : setRecording(true)

  return (
    <div className="screen live-screen">
      <div className="live-top-view">
        <div className="page-header live-page-header"><h1>Live Stream</h1><p>Monitor real-time events from your app as they happen.</p></div>
        <section className="stream-controls-panel" aria-label="Stream Controls">
          <span className="stream-controls-title">Stream Controls</span>
          <div className="stream-control-items">
            <button className="stream-control-item primary" onClick={() => setStreamState(streamState === 'running' ? 'paused' : 'running')}>
              <span>{streamState === 'running' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span>
              <strong>{streamState === 'running' ? 'Pause' : 'Play'}</strong>
            </button>
            <button className="stream-control-item" disabled={streamState === 'stopped'} onClick={() => setStreamState('stopped')}><span><Square fill="currentColor" /></span><strong>Stop</strong></button>
            <button className="stream-control-item" onClick={() => setVisibleEvents([])}><span><Trash2 /></span><strong>Clear</strong></button>
            <i className="stream-control-divider" />
            <button className="stream-control-item record" onClick={toggleRecording}><span><Circle fill={recording ? 'var(--danger)' : 'none'} /></span><strong>{recording ? 'Stop Session' : 'Record Session'}</strong></button>
          </div>
        </section>
      </div>
      <div className="live-gradient-divider" />
      <div className="live-bottom-view">
        <div className="live-filter-row">
          <div className="live-filters">
            <label className="search-field"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by event name..." /></label>
            <Select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option>All Tags</option><option>Firebase Analytics</option><option>Google Analytics</option><option>MoEngage</option>
            </Select>
          </div>
          <div className="event-count"><span className="dot success" /><strong>{filtered.length}</strong> events streaming</div>
        </div>
        <div className="live-grid">
          <div className="event-list" ref={scrollRef}>
            {filtered.length === 0 ? <div className="empty-list">Waiting for events...</div> : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const event = filtered[item.index]
                  return <div key={event.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}><EventRow event={event} selected={selected.id === event.id} onSelect={() => setSelected(event)} /></div>
                })}
              </div>
            )}
          </div>
          <section className="panel event-details">
            <div className="panel-title"><h2>Event Details</h2><IconButton label="Close details" bare><X size={19} /></IconButton></div>
            <dl className="details-list">
              <dt>Event Name</dt><dd>{selected.name}</dd>
            </dl>
            <div className="json-head"><h3>Event JSON</h3><CopyButton text={json} /></div>
            <pre className="json-view"><code>{json}</code></pre>
          </section>
        </div>
      </div>
      {saveModal && <Modal title="Save recorded session?" onClose={() => setSaveModal(false)} actions={<><Button onClick={() => { setRecording(false); setSaveModal(false) }}>Discard</Button><Button variant="primary" disabled={!sessionName.trim()} onClick={() => { setRecording(false); setSaveModal(false) }}>Save</Button></>}>
        <label className="field-label">Session name<Input autoFocus value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Enter a session name..." /></label>
      </Modal>}
    </div>
  )
}
