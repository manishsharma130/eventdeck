import { useEffect, useMemo } from 'react'
import { GripVertical, Plus, Search, Trash2, X } from 'lucide-react'
import { Button, Checkbox, IconButton, Input, Modal, PageHeader, Panel } from '../components/ui'
import { api, ApiError, type EventDefinition, type Flow } from '../services/api'
import { useTabState } from '../state/tab-ui-store'
import { VirtualList } from '../components/VirtualList'

export function BuildFlow() {
  const [deleteError, setDeleteError] = useTabState('build', 'deleteError', '')
  const [query, setQuery] = useTabState('build', 'query', '')
  const [flows, setFlows] = useTabState<Flow[]>('build', 'flows', [])
  const [definitions, setDefinitions] = useTabState<EventDefinition[]>('build', 'definitions', [])
  const [selectedId, setSelectedId] = useTabState<string | null>('build', 'selectedId', null)
  const [checked, setChecked] = useTabState<string[]>('build', 'checked', [])
  const [name, setName] = useTabState('build', 'name', '')
  const [selectedEvents, setSelectedEvents] = useTabState<string[]>('build', 'selectedEvents', [])
  const [creationOpen, setCreationOpen] = useTabState('build', 'creationOpen', false)
  const [eventPickerOpen, setEventPickerOpen] = useTabState('build', 'eventPickerOpen', false)
  const [eventQuery, setEventQuery] = useTabState('build', 'eventQuery', '')
  const [draftEvents, setDraftEvents] = useTabState<string[]>('build', 'draftEvents', [])
  const [duplicateName, setDuplicateName] = useTabState('build', 'duplicateName', '')
  const [draggedEventId, setDraggedEventId] = useTabState<string | null>('build', 'draggedEventId', null)
  const [message, setMessage] = useTabState('build', 'message', 'Loading flows…')
  const filtered = useMemo(() => flows.filter((flow) => flow.name.toLowerCase().includes(query.toLowerCase())), [flows, query])
  const filteredDefinitions = useMemo(() => definitions.filter((definition) =>
    `${definition.name} ${definition.eventValue}`.toLowerCase().includes(eventQuery.toLowerCase()),
  ), [definitions, eventQuery])
  const definitionsById = useMemo(() => new Map(definitions.map((definition) => [definition.id, definition])), [definitions])
  const checkedSet = useMemo(() => new Set(checked), [checked])
  const draftEventSet = useMemo(() => new Set(draftEvents), [draftEvents])
  const sortFlows = (items: Flow[]) => [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
  const refresh = async () => { try { const [savedFlows, savedDefinitions] = await Promise.all([api.flows(), api.rules()]); setFlows(savedFlows); setDefinitions(savedDefinitions); setChecked((current) => current.filter((id) => savedFlows.some((flow) => flow.id === id))); setSelectedEvents((current) => current.filter((id) => savedDefinitions.some((definition) => definition.id === id))); setDraftEvents((current) => current.filter((id) => savedDefinitions.some((definition) => definition.id === id))); if (selectedId && !savedFlows.some((flow) => flow.id === selectedId)) closeCreation(); setMessage(savedFlows.length ? '' : 'No flows yet.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load flows.') } }
  useEffect(() => { void refresh() }, [])
  const choose = (flow: Flow) => { setSelectedId(flow.id); setName(flow.name); setSelectedEvents([...flow.events].sort((a, b) => a.position - b.position).map((event) => event.eventDefinitionId)); setCreationOpen(true) }
  const clear = () => { setSelectedId(null); setName(''); setSelectedEvents([]); setMessage('') }
  const closeCreation = () => { clear(); setCreationOpen(false) }
  const addFlow = () => { clear(); setCreationOpen(true) }
  const save = async () => { try { const saved = selectedId ? await api.updateFlow(selectedId, name, selectedEvents) : await api.createFlow(name, selectedEvents); setFlows((current) => sortFlows(selectedId ? current.map((flow) => flow.id === saved.id ? saved : flow) : [...current, saved])); closeCreation(); setMessage('Flow saved.') } catch (cause) { if (cause instanceof ApiError && cause.code === 'FLOW_NAME_ALREADY_EXISTS') { setDuplicateName(`${cause.message} Please use a different name.`); return } setMessage(cause instanceof Error ? cause.message : 'Could not save flow.') } }
  const remove = async (ids: string[]) => { try { await api.deleteFlows(ids); const removed = new Set(ids); setFlows((current) => current.filter((flow) => !removed.has(flow.id))); setChecked([]); if (selectedId && removed.has(selectedId)) closeCreation(); setMessage('Flow deleted.') } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Could not delete flow.') } }
  const openEventPicker = () => { setDraftEvents(selectedEvents); setEventQuery(''); setEventPickerOpen(true) }
  const toggleDraftEvent = (id: string) => setDraftEvents((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const moveEvent = (targetId: string) => {
    if (!draggedEventId || draggedEventId === targetId) return
    setSelectedEvents((current) => {
      const next = current.filter((id) => id !== draggedEventId)
      next.splice(current.indexOf(targetId), 0, draggedEventId)
      return next
    })
    setDraggedEventId(null)
  }
  return (
    <div className="screen">
      <PageHeader title="Build Flow" description="Create and manage event flows to route your data across destinations." />
      <div className={`split-grid build-grid ${creationOpen ? 'details-open' : 'details-closed'}`}>
        <Panel className="flow-list-panel">
          <div className="flows-toolbar">
            <label className="search-field flows-search"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flows..." /></label>
            <div className="toolbar flows-toolbar-actions"><Button variant="primary" onClick={addFlow}><Plus size={21} />Add Flow</Button><Button disabled={!checked.length} onClick={() => void remove(checked)}><Trash2 size={19} />Delete Flow</Button></div>
          </div>
          {filtered.length > 0 && <VirtualList className="flow-list" items={filtered} estimateSize={70} getKey={(flow) => flow.id} renderItem={(flow) =>
              <div role="button" tabIndex={0} className={`flow-row ${selectedId === flow.id ? 'selected' : ''}`} onClick={() => choose(flow)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') choose(flow) }}>
                <span onClick={(event) => event.stopPropagation()}><Checkbox label={`Select ${flow.name}`} checked={checkedSet.has(flow.id)} onChange={() => setChecked((value) => value.includes(flow.id) ? value.filter((item) => item !== flow.id) : [...value, flow.id])} /></span>
                <strong>{flow.name}</strong><span className="event-pill">{flow.events.length} events</span>
              </div>
          } />}
          {message && <div className="empty-list" role="status">{message}</div>}
        </Panel>
        {creationOpen && <Panel className="flow-creation">
          <div className="panel-title"><div><h2>Flow Creation</h2><p>Add a name and define the events for this flow.</p></div><IconButton bare label="Close flow creation" onClick={closeCreation}><X size={19} /></IconButton></div>
          <label className="field-label">Flow Name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter flow name..." /></label>
          <div className="section-divider" />
          <div className="flow-events-head"><div><h3>Add Events</h3><p>Add and arrange events that will be part of this flow.</p></div><Button variant="primary" disabled={!definitions.length} onClick={openEventPicker}><Plus size={20} />Add Events</Button></div>
          <VirtualList className="ordered-events" items={selectedEvents} estimateSize={66} getKey={(eventId) => eventId} renderItem={(eventId) => { const definition = definitionsById.get(eventId); return <div className={`ordered-event ${draggedEventId === eventId ? 'dragging' : ''}`} draggable onDragStart={() => setDraggedEventId(eventId)} onDragEnd={() => setDraggedEventId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveEvent(eventId)}><GripVertical size={22} aria-label="Drag to reorder" /><strong>{definition?.name ?? eventId}</strong><button aria-label={`Remove ${definition?.name ?? eventId}`} onClick={() => setSelectedEvents(selectedEvents.filter((item) => item !== eventId))}><Trash2 size={19} /></button></div> }} />
          <div className="form-actions"><Button onClick={clear}>Clear</Button><Button variant="primary" disabled={!name.trim() || !selectedEvents.length} onClick={() => void save()}>Save Flow</Button></div>
        </Panel>}
      </div>
      {eventPickerOpen && <Modal className="event-picker-modal" title="Add Events" onClose={() => setEventPickerOpen(false)} actions={<><Button onClick={() => setEventPickerOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { setSelectedEvents(draftEvents); setEventPickerOpen(false) }}>Save</Button></>}>
        <label className="search-field event-picker-search"><Search size={19} /><Input autoFocus value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} placeholder="Search created events..." /></label>
        {filteredDefinitions.length > 0 ? <VirtualList className="event-picker-list" items={filteredDefinitions} estimateSize={66} getKey={(definition) => definition.id} renderItem={(definition) => {
            const selected = draftEventSet.has(definition.id)
            return <div className={`event-picker-row ${selected ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => toggleDraftEvent(definition.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleDraftEvent(definition.id) }}>
              <span onClick={(event) => event.stopPropagation()}><Checkbox label={`Select ${definition.name}`} checked={selected} onChange={() => toggleDraftEvent(definition.id)} /></span>
              <span className="definition-name"><strong>{definition.name}</strong><small>Value: {definition.eventValue}</small></span>
              <span className={`rule-count ${definition.rules.length ? 'has-rules' : ''}`}>{definition.rules.length ? `${definition.rules.length} ${definition.rules.length === 1 ? 'rule' : 'rules'}` : 'No rules'}</span>
            </div>
          }} /> : <div className="event-picker-list"><div className="event-picker-empty">No created events found.</div></div>}
      </Modal>}
      {deleteError && <Modal title="Cannot delete flow" onClose={() => setDeleteError('')} actions={<Button onClick={() => setDeleteError('')}>OK</Button>}><p role="alert">{deleteError}</p></Modal>}
      {duplicateName && <Modal title="Flow name already exists" onClose={() => setDuplicateName('')} actions={<Button variant="primary" onClick={() => setDuplicateName('')}>OK</Button>}><p>{duplicateName}</p></Modal>}
    </div>
  )
}
