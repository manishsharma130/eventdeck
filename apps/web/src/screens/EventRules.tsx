import { useEffect, useMemo } from 'react'
import { FileText, MoreVertical, Plus, Search, Trash2, X } from 'lucide-react'
import { Button, Checkbox, IconButton, Input, Modal, PageHeader, Panel, Select } from '../components/ui'
import { api, ApiError, type EventDefinition, type MatchType } from '../services/api'
import { useTabState } from '../state/tab-ui-store'

type Rule = { parameter: string; condition: MatchType; value: string }
const emptyRule = (): Rule => ({ parameter: '', condition: 'exact', value: '' })

export function EventRules() {
  const [definitions, setDefinitions] = useTabState<EventDefinition[]>('rules', 'definitions', [])
  const [selectedId, setSelectedId] = useTabState<string | null>('rules', 'selectedId', null)
  const [checked, setChecked] = useTabState<string[]>('rules', 'checked', [])
  const [searchDraft, setSearchDraft] = useTabState('rules', 'searchDraft', '')
  const [query, setQuery] = useTabState('rules', 'query', '')
  const [formOpen, setFormOpen] = useTabState('rules', 'formOpen', false)
  const [eventName, setEventName] = useTabState('rules', 'eventName', '')
  const [eventValue, setEventValue] = useTabState('rules', 'eventValue', '')
  const [rules, setRules] = useTabState<Rule[]>('rules', 'rules', [])
  const [message, setMessage] = useTabState('rules', 'message', 'Loading event rules…')
  const [duplicateMessage, setDuplicateMessage] = useTabState('rules', 'duplicateMessage', '')
  const [pendingDelete, setPendingDelete] = useTabState<{ ids: string[]; flowCount: number } | null>('rules', 'pendingDelete', null)

  const list = useMemo(() => definitions.filter((item) =>
    `${item.name} ${item.eventValue}`.toLowerCase().includes(query.toLowerCase()),
  ), [definitions, query])
  const checkedSet = useMemo(() => new Set(checked), [checked])
  const sortDefinitions = (items: EventDefinition[]) => [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))

  const resetForm = () => {
    setSelectedId(null)
    setEventName('')
    setEventValue('')
    setRules([])
  }
  const closeForm = () => { resetForm(); setFormOpen(false) }
  const addEvent = () => { resetForm(); setMessage(''); setFormOpen(true) }
  const choose = (definition: EventDefinition) => {
    setSelectedId(definition.id)
    setEventValue(definition.eventValue)
    setEventName(definition.name)
    setRules(definition.rules.map((rule) => ({ parameter: rule.paramKey, condition: rule.matchType, value: rule.expectedValue ?? '' })))
    setFormOpen(true)
  }
  const updateRule = (index: number, key: keyof Rule, value: string) => setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [key]: value } : rule))
  const refresh = async () => {
    try {
      const items = await api.rules()
      setDefinitions(items)
      setMessage(items.length ? '' : 'No event rules yet.')
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load event rules.') }
  }
  useEffect(() => { void refresh() }, [])

  const save = async () => {
    const editing = Boolean(selectedId)
    const input = {
      name: eventName.trim(),
      eventValue: eventValue.trim(),
      rules: rules.map((rule) => ({ paramKey: rule.parameter.trim(), matchType: rule.condition, ...(rule.condition === 'exists' ? {} : { expectedValue: rule.value.trim() }) })),
    }
    try {
      const saved = selectedId ? await api.updateRule(selectedId, input) : await api.createRule(input)
      setDefinitions((current) => sortDefinitions(selectedId ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]))
      closeForm()
      setMessage(editing ? 'Event rule updated.' : 'Event rule saved.')
    } catch (cause) {
      if (cause instanceof ApiError && (cause.code === 'EVENT_NAME_ALREADY_EXISTS' || cause.code === 'EVENT_DEFINITION_ALREADY_EXISTS')) {
        setDuplicateMessage(`${cause.message} Please change the rules in order to make it different.`)
        return
      }
      setMessage(cause instanceof Error ? cause.message : 'Could not save event rule.')
    }
  }
  const performRemove = async (ids: string[]) => {
    try {
      await api.deleteRules(ids)
      const removed = new Set(ids)
      setDefinitions((current) => current.filter((item) => !removed.has(item.id)))
      setChecked([])
      if (selectedId && removed.has(selectedId)) closeForm()
      setMessage('Event rule deleted.')
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not delete event rule.') }
  }
  const requestRemove = async (ids: string[]) => {
    try {
      const { flowCount } = await api.rulesUsage(ids)
      if (flowCount > 0) { setPendingDelete({ ids, flowCount }); return }
      await performRemove(ids)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not check event usage.') }
  }

  return (
    <div className="screen">
      <PageHeader title="Event Rules" description="Define reusable event definitions and rules to capture and process important in-app events." />
      <div className={`split-grid rules-grid ${formOpen ? 'details-open' : 'details-closed'}`}>
        <Panel className="list-panel">
          <div className="rules-toolbar">
            <form className="rules-search" onSubmit={(event) => { event.preventDefault(); setQuery(searchDraft.trim()) }}>
              <label className="search-field"><Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search events..." /><IconButton bare label="Search events" type="submit"><Search size={19} /></IconButton></label>
            </form>
            <div className="toolbar rules-toolbar-actions"><Button variant="primary" onClick={addEvent}><Plus size={20} />Add Event</Button><Button disabled={!checked.length} onClick={() => void requestRemove(checked)}><Trash2 size={18} />Delete</Button><span className="toolbar-separator" /><Button disabled={!definitions.length} onClick={() => void requestRemove(definitions.map((item) => item.id))}><Trash2 size={18} />Delete All</Button></div>
          </div>
          <div className="definition-list">
            {list.map((definition, index) => <div key={definition.id} role="button" tabIndex={0} className={`definition-row ${selectedId === definition.id ? 'selected' : ''}`} onClick={() => choose(definition)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') choose(definition) }}>
              <span onClick={(event) => event.stopPropagation()}><Checkbox label={`Select ${definition.name}`} checked={checkedSet.has(definition.id)} onChange={() => setChecked((value) => value.includes(definition.id) ? value.filter((item) => item !== definition.id) : [...value, definition.id])} /></span>
              <span className="sequence">{String(index + 1).padStart(3, '0')}</span>
              <span className="definition-name"><strong>{definition.name}</strong><small>Value: {definition.eventValue}</small></span>
              <span className={`rule-count ${definition.rules.length ? 'has-rules' : ''}`}><FileText size={20} />{definition.rules.length ? `${definition.rules.length} ${definition.rules.length === 1 ? 'rule' : 'rules'}` : 'No rules'}</span>
              <MoreVertical size={18} />
            </div>)}
            {message && <div className="empty-list" role="status">{message}</div>}
          </div>
        </Panel>
        {formOpen && <Panel className="form-panel">
          <div className="panel-title"><div><h2>Event Information</h2><p>Configure the event details and define matching rules.</p></div><IconButton bare label="Close event information" onClick={closeForm}><X size={19} /></IconButton></div>
          <label className="field-label">Event Name <span>(Required)</span><Input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Enter a display name for this event..." /></label>
          <label className="field-label">Event Value <span>(Required)</span><Input className="focused" value={eventValue} onChange={(event) => setEventValue(event.target.value)} placeholder="Enter the live event name..." /></label>
          <div className="rules-heading"><div><h3>Event Rules <span>(Optional)</span></h3><p>Define rules to match this event based on parameters, values, or patterns.</p></div><Button variant="primary" onClick={() => setRules((current) => [...current, emptyRule()])}><Plus size={19} />Add Rule</Button></div>
          <div className="rules-table"><div className="rule-table-head"><span>#</span><span>Event Parameter</span><span>Condition</span><span>Value</span><span /></div>
            {rules.map((rule, index) => <div className="rule-row" key={index}>
              <span>{index + 1}</span><Input value={rule.parameter} onChange={(event) => updateRule(index, 'parameter', event.target.value)} placeholder="e.g. screen" />
              <Select value={rule.condition} onChange={(event) => updateRule(index, 'condition', event.target.value)}><option value="exact">Exact</option><option value="contains">Contains</option><option value="exists">Exists</option><option value="regex">Regex</option></Select>
              <Input value={rule.value} disabled={rule.condition === 'exists'} onChange={(event) => updateRule(index, 'value', event.target.value)} placeholder={rule.condition === 'exists' ? 'Not required' : 'Expected value'} />
              <button aria-label="Delete rule" onClick={() => setRules((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} /></button>
            </div>)}
          </div>
          <div className="form-actions"><Button onClick={resetForm}>Clear</Button><Button variant="primary" disabled={!eventName.trim() || !eventValue.trim()} onClick={() => void save()}>{selectedId ? 'Update' : 'Save'}</Button></div>
        </Panel>}
      </div>
      {duplicateMessage && <Modal title="Event rule already exists" onClose={() => setDuplicateMessage('')} actions={<Button variant="primary" onClick={() => setDuplicateMessage('')}>OK</Button>}><p>{duplicateMessage}</p></Modal>}
      {pendingDelete && <Modal title="Delete event definition?" onClose={() => setPendingDelete(null)} actions={<><Button onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="danger" onClick={() => { const ids = pendingDelete.ids; setPendingDelete(null); void performRemove(ids) }}>Delete</Button></>}><p>{pendingDelete.ids.length === 1 ? `This event is currently used in ${pendingDelete.flowCount} ${pendingDelete.flowCount === 1 ? 'flow' : 'flows'}.` : `The selected events have ${pendingDelete.flowCount} flow references.`} Deleting {pendingDelete.ids.length === 1 ? 'it' : 'them'} will remove {pendingDelete.ids.length === 1 ? 'it' : 'them'} from those flows as well. The flows themselves will remain.</p></Modal>}
    </div>
  )
}
