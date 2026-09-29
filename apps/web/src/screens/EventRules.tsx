import { useEffect, useMemo, useState } from 'react'
import { FileText, MoreVertical, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Checkbox, Input, PageHeader, Panel, Select } from '../components/ui'
import { api, type EventDefinition, type MatchType } from '../services/api'

type Rule = { parameter: string; condition: string; value: string; priority: number }

export function EventRules() {
  const [definitions, setDefinitions] = useState<EventDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventValue, setEventValue] = useState('app_open')
  const [rules, setRules] = useState<Rule[]>([
    { parameter: 'eventName', condition: 'Match', value: 'app_open', priority: 1 },
    { parameter: 'screenName', condition: 'Contains', value: 'home', priority: 2 },
    { parameter: 'referrer', condition: 'Regex', value: '^(organic|ads)$', priority: 3 },
  ])
  const [message, setMessage] = useState('Loading event rules…')
  const list = useMemo(() => definitions.filter((item) => `${item.name} ${item.eventValue}`.toLowerCase().includes(query.toLowerCase())), [definitions, query])
  const choose = (definition: EventDefinition) => { setSelectedId(definition.id); setEventValue(definition.eventValue); setEventName(definition.name); setRules(definition.rules.map((rule, index) => ({ parameter: rule.paramKey, condition: rule.matchType === 'exact' ? 'Match' : `${rule.matchType[0].toUpperCase()}${rule.matchType.slice(1)}`, value: rule.expectedValue ?? '', priority: index + 1 }))) }
  const updateRule = (index: number, key: keyof Rule, value: string | number) => setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [key]: value } : rule))
  const clear = () => { setSelectedId(null); setEventName(''); setEventValue(''); setRules([]); setMessage('') }
  const refresh = async () => { try { const items = await api.rules(); setDefinitions(items); setMessage(items.length ? '' : 'No event rules yet.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load event rules.') } }
  useEffect(() => { void refresh() }, [])
  const save = async () => {
    const input = { name: eventName.trim() || eventValue.trim(), eventValue: eventValue.trim(), rules: rules.map((rule) => ({ paramKey: rule.parameter, matchType: (rule.condition === 'Match' ? 'exact' : rule.condition.toLowerCase()) as MatchType, ...(rule.condition === 'Exists' ? {} : { expectedValue: rule.value }) })) }
    try { if (selectedId) await api.updateRule(selectedId, input); else await api.createRule(input); await refresh(); clear(); setMessage('Event rule saved.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save event rule.') }
  }
  const remove = async (ids: string[]) => { try { await Promise.all(ids.map((id) => api.deleteRule(id))); setChecked([]); if (selectedId && ids.includes(selectedId)) clear(); await refresh(); setMessage('Event rule deleted.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not delete event rule.') } }

  return (
    <div className="screen">
      <PageHeader title="Event Rules" description="Define reusable event definitions and rules to capture and process important in-app events." />
      <div className="split-grid rules-grid">
        <Panel className="list-panel">
          <div className="toolbar"><Button variant="primary" onClick={clear}><Plus size={20} />Add Event</Button><Button disabled={!checked.length} onClick={() => void remove(checked)}><Trash2 size={18} />Delete</Button><span className="toolbar-separator" /><Button disabled={!definitions.length} onClick={() => void remove(definitions.map((item) => item.id))}><Trash2 size={18} />Delete All</Button></div>
          <div className="compact-filters"><label className="search-field"><Search size={19} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events..." /></label><Select><option>All Tags</option></Select></div>
          <div className="definition-list">
            {list.map((definition, index) => (
              <button key={definition.id} className={`definition-row ${selectedId === definition.id ? 'selected' : ''}`} onClick={() => choose(definition)}>
                <Checkbox label={`Select ${definition.name}`} checked={checked.includes(definition.id)} onChange={() => setChecked((value) => value.includes(definition.id) ? value.filter((item) => item !== definition.id) : [...value, definition.id])} />
                <span className="sequence">{String(index + 1).padStart(3, '0')}</span>
                <span className="definition-name"><strong>{definition.name}</strong><small>Value: {definition.eventValue}</small></span>
                <span className={`rule-count ${definition.rules.length ? 'has-rules' : ''}`}><FileText size={20} />{definition.rules.length ? `${definition.rules.length} ${definition.rules.length === 1 ? 'rule' : 'rules'}` : 'No rules'}</span>
                <MoreVertical size={18} />
              </button>
            ))}
            {message && <div className="empty-list" role="status">{message}</div>}
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
          <div className="form-actions"><Button onClick={clear}>Clear</Button><Button variant="primary" disabled={!eventValue.trim()} onClick={() => void save()}>Save</Button></div>
        </Panel>
      </div>
    </div>
  )
}
