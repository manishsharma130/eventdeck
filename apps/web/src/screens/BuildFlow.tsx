import { useMemo, useState } from 'react'
import { Box, CreditCard, FileText, GripVertical, Heart, Megaphone, Plus, Search, ShoppingCart, Star, Trash2, UserRound } from 'lucide-react'
import { flows } from '../data/mockData'
import { Button, Checkbox, Input, PageHeader, Panel } from '../components/ui'

const flowIcons = { cart: ShoppingCart, user: UserRound, card: CreditCard, megaphone: Megaphone, heart: Heart, box: Box, file: FileText, star: Star }
const flowEvents = ['app_open', 'screen_view', 'button_click', 'add_to_cart', 'purchase', 'purchase_confirmed']
const eventIcons = [UserRound, Search, FileText, ShoppingCart, CreditCard, Star]

export function BuildFlow() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [checked, setChecked] = useState<number[]>([])
  const [name, setName] = useState('')
  const [selectedEvents, setSelectedEvents] = useState(flowEvents)
  const filtered = useMemo(() => flows.filter(([flowName]) => flowName.toLowerCase().includes(query.toLowerCase())), [query])
  return (
    <div className="screen">
      <PageHeader title="Build Flow" description="Create and manage event flows to route your data across destinations." />
      <div className="split-grid build-grid">
        <Panel className="flow-list-panel">
          <div className="toolbar"><Button variant="primary"><Plus size={21} />Add Flow</Button><Button disabled={!checked.length}><Trash2 size={19} />Delete Flow</Button></div>
          <label className="search-field wide"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flows..." /></label>
          <div className="flow-list">
            {filtered.map(([flowName, count, icon], index) => {
              const Icon = flowIcons[icon]
              return <button key={flowName} className={`flow-row ${selected === index ? 'selected' : ''}`} onClick={() => setSelected(index)}>
                <Checkbox label={`Select ${flowName}`} checked={checked.includes(index)} onChange={() => setChecked((value) => value.includes(index) ? value.filter((item) => item !== index) : [...value, index])} />
                <span className={`flow-icon tone-${index % 6}`}><Icon size={23} fill="currentColor" /></span><strong>{flowName}</strong><span className="event-pill">{count} events</span><Trash2 size={20} />
              </button>
            })}
          </div>
        </Panel>
        <Panel className="flow-creation">
          <h2>Flow Creation</h2><p>Add a name and define the events for this flow.</p>
          <label className="field-label">Flow Name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter flow name..." /></label>
          <div className="section-divider" />
          <div className="flow-events-head"><div><h3>Add Events</h3><p>Add and arrange events that will be part of this flow.</p></div><Button variant="primary"><Plus size={20} />Add Event</Button></div>
          <div className="ordered-events">
            {selectedEvents.map((eventName, index) => { const Icon = eventIcons[index % eventIcons.length]; return <div className="ordered-event" key={eventName}><GripVertical size={22} /><span className={`flow-icon tone-${index % 6}`}><Icon size={21} fill="currentColor" /></span><strong>{eventName}</strong><button aria-label={`Remove ${eventName}`} onClick={() => setSelectedEvents(selectedEvents.filter((item) => item !== eventName))}><Trash2 size={19} /></button></div> })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
