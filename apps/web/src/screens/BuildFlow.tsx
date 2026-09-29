import { useEffect, useMemo, useState } from 'react'
import { Box, CreditCard, FileText, GripVertical, Heart, Megaphone, Plus, Search, ShoppingCart, Star, Trash2, UserRound } from 'lucide-react'
import { Button, Checkbox, Input, PageHeader, Panel } from '../components/ui'
import { api, type EventDefinition, type Flow } from '../services/api'

const flowIcons = { cart: ShoppingCart, user: UserRound, card: CreditCard, megaphone: Megaphone, heart: Heart, box: Box, file: FileText, star: Star }
const eventIcons = [UserRound, Search, FileText, ShoppingCart, CreditCard, Star]

export function BuildFlow() {
  const [query, setQuery] = useState('')
  const [flows, setFlows] = useState<Flow[]>([])
  const [definitions, setDefinitions] = useState<EventDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [name, setName] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [message, setMessage] = useState('Loading flows…')
  const filtered = useMemo(() => flows.filter((flow) => flow.name.toLowerCase().includes(query.toLowerCase())), [flows, query])
  const refresh = async () => { try { const [savedFlows, savedDefinitions] = await Promise.all([api.flows(), api.rules()]); setFlows(savedFlows); setDefinitions(savedDefinitions); setMessage(savedFlows.length ? '' : 'No flows yet.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load flows.') } }
  useEffect(() => { void refresh() }, [])
  const choose = (flow: Flow) => { setSelectedId(flow.id); setName(flow.name); setSelectedEvents([...flow.events].sort((a, b) => a.position - b.position).map((event) => event.eventDefinitionId)) }
  const clear = () => { setSelectedId(null); setName(''); setSelectedEvents([]); setMessage('') }
  const save = async () => { try { if (selectedId) await api.updateFlow(selectedId, name, selectedEvents); else await api.createFlow(name, selectedEvents); await refresh(); clear(); setMessage('Flow saved.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save flow.') } }
  const remove = async (ids: string[]) => { try { await Promise.all(ids.map((id) => api.deleteFlow(id))); setChecked([]); clear(); await refresh(); setMessage('Flow deleted.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not delete flow.') } }
  return (
    <div className="screen">
      <PageHeader title="Build Flow" description="Create and manage event flows to route your data across destinations." />
      <div className="split-grid build-grid">
        <Panel className="flow-list-panel">
          <div className="toolbar"><Button variant="primary" onClick={clear}><Plus size={21} />Add Flow</Button><Button disabled={!checked.length} onClick={() => void remove(checked)}><Trash2 size={19} />Delete Flow</Button></div>
          <label className="search-field wide"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flows..." /></label>
          <div className="flow-list">
            {filtered.map((flow, index) => {
              const Icon = Object.values(flowIcons)[index % Object.values(flowIcons).length]
              return <button key={flow.id} className={`flow-row ${selectedId === flow.id ? 'selected' : ''}`} onClick={() => choose(flow)}>
                <Checkbox label={`Select ${flow.name}`} checked={checked.includes(flow.id)} onChange={() => setChecked((value) => value.includes(flow.id) ? value.filter((item) => item !== flow.id) : [...value, flow.id])} />
                <span className={`flow-icon tone-${index % 6}`}><Icon size={23} fill="currentColor" /></span><strong>{flow.name}</strong><span className="event-pill">{flow.events.length} events</span><Trash2 size={20} />
              </button>
            })}
            {message && <div className="empty-list" role="status">{message}</div>}
          </div>
        </Panel>
        <Panel className="flow-creation">
          <h2>Flow Creation</h2><p>Add a name and define the events for this flow.</p>
          <label className="field-label">Flow Name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter flow name..." /></label>
          <div className="section-divider" />
          <div className="flow-events-head"><div><h3>Add Events</h3><p>Add and arrange events that will be part of this flow.</p></div><Button variant="primary" disabled={!definitions.some((item) => !selectedEvents.includes(item.id))} onClick={() => { const next = definitions.find((item) => !selectedEvents.includes(item.id)); if (next) setSelectedEvents([...selectedEvents, next.id]) }}><Plus size={20} />Add Event</Button></div>
          <div className="ordered-events">
            {selectedEvents.map((eventId, index) => { const definition = definitions.find((item) => item.id === eventId); const Icon = eventIcons[index % eventIcons.length]; return <div className="ordered-event" key={eventId}><GripVertical size={22} /><span className={`flow-icon tone-${index % 6}`}><Icon size={21} fill="currentColor" /></span><strong>{definition?.name ?? eventId}</strong><button aria-label={`Remove ${definition?.name ?? eventId}`} onClick={() => setSelectedEvents(selectedEvents.filter((item) => item !== eventId))}><Trash2 size={19} /></button></div> })}
          </div>
          <div className="form-actions"><Button onClick={clear}>Clear</Button><Button variant="primary" disabled={!name.trim() || !selectedEvents.length} onClick={() => void save()}>Save Flow</Button></div>
        </Panel>
      </div>
    </div>
  )
}
