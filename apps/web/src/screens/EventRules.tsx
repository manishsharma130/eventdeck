import { useMemo, useState } from 'react'
import { FileText, MoreVertical, Plus, Search, Trash2 } from 'lucide-react'
import { eventDefinitions } from '../data/mockData'
import { Button, Checkbox, Input, PageHeader, Panel, Select } from '../components/ui'

type Rule = { parameter: string; condition: string; value: string; priority: number }

export function EventRules() {
  const [selected, setSelected] = useState(0)
  const [checked, setChecked] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventValue, setEventValue] = useState('app_open')
  const [rules, setRules] = useState<Rule[]>([
    { parameter: 'eventName', condition: 'Match', value: 'app_open', priority: 1 },
    { parameter: 'screenName', condition: 'Contains', value: 'home', priority: 2 },
    { parameter: 'referrer', condition: 'Regex', value: '^(organic|ads)$', priority: 3 },
  ])
  const list = useMemo(() => eventDefinitions.filter(([name]) => name.includes(query.toLowerCase())), [query])
  const choose = (index: number, name: string) => { setSelected(index); setEventValue(name); setEventName('') }
  const updateRule = (index: number, key: keyof Rule, value: string | number) => setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [key]: value } : rule))

  return (
    <div className="screen">
      <PageHeader title="Event Rules" description="Define reusable event definitions and rules to capture and process important in-app events." />
      <div className="split-grid rules-grid">
        <Panel className="list-panel">
          <div className="toolbar"><Button variant="primary"><Plus size={20} />Add Event</Button><Button disabled={!checked.length}><Trash2 size={18} />Delete</Button><span className="toolbar-separator" /><Button><Trash2 size={18} />Delete All</Button></div>
          <div className="compact-filters"><label className="search-field"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events..." /></label><Select><option>All Tags</option></Select></div>
          <div className="definition-list">
            {list.map(([name, count], index) => (
              <button key={name} className={`definition-row ${selected === index ? 'selected' : ''}`} onClick={() => choose(index, name)}>
                <Checkbox label={`Select ${name}`} checked={checked.includes(index)} onChange={() => setChecked((value) => value.includes(index) ? value.filter((item) => item !== index) : [...value, index])} />
                <span className="sequence">{String(index + 1).padStart(3, '0')}</span>
                <span className="definition-name"><strong>{name}</strong><small>Value: {name}</small></span>
                <span className={`rule-count ${count ? 'has-rules' : ''}`}><FileText size={20} />{count ? `${count} ${count === 1 ? 'rule' : 'rules'}` : 'No rules'}</span>
                <MoreVertical size={18} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel className="form-panel">
          <h2>Event Information</h2><p>Configure the event details and define matching rules.</p>
          <label className="field-label">Event Name <span>(Optional)</span><Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Enter a display name for this event..." /></label>
          <label className="field-label">Event Value <span>(Required)</span><Input className="focused" value={eventValue} onChange={(e) => setEventValue(e.target.value)} /></label>
          <div className="rules-heading"><div><h3>Event Rules <span>(Optional)</span></h3><p>Define rules to match this event based on parameters, values, or patterns.</p></div><Button variant="primary" onClick={() => setRules([...rules, { parameter: 'eventName', condition: 'Match', value: '', priority: rules.length + 1 }])}><Plus size={19} />Add Rule</Button></div>
          <div className="rules-table"><div className="rule-table-head"><span>#</span><span>Event Parameter</span><span>Condition</span><span>Value</span><span>Priority</span><span /></div>
            {rules.map((rule, index) => <div className="rule-row" key={index}>
              <span>{index + 1}</span><Select value={rule.parameter} onChange={(e) => updateRule(index, 'parameter', e.target.value)}><option>eventName</option><option>screenName</option><option>referrer</option></Select>
              <Select value={rule.condition} onChange={(e) => updateRule(index, 'condition', e.target.value)}><option>Match</option><option>Contains</option><option>Regex</option></Select>
              <Input value={rule.value} onChange={(e) => updateRule(index, 'value', e.target.value)} /><Input type="number" value={rule.priority} onChange={(e) => updateRule(index, 'priority', Number(e.target.value))} />
              <button aria-label="Delete rule" onClick={() => setRules(rules.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} /></button>
            </div>)}
          </div>
          <div className="form-actions"><Button>Clear</Button><Button variant="primary" disabled={!eventValue.trim()}>Save</Button></div>
        </Panel>
      </div>
    </div>
  )
}
