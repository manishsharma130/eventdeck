import { useEffect, useMemo, type KeyboardEvent } from 'react'
import { ArrowRight, BarChart3, Check, Circle, CircleX, GitBranch, Info, ListTree, LoaderCircle, Pause, Play, Plus, RotateCcw, Search, Square, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, IconButton, Input, Modal, PageHeader, Panel, Select } from '../components/ui'
import { api, type Completion, type ExecutionState, type Flow, type SelectedFlow } from '../services/api'
import type { EventDeckWebSocket } from '../services/websocket'
import { useLiveStreamStore } from '../state/live-stream-store'
import { useTabState } from '../state/tab-ui-store'
import { VirtualList } from '../components/VirtualList'

type ExecutionStatus = 'passed' | 'pending' | 'failed'
type FinalFlowStatus = 'PASSED' | 'PARTIAL' | 'FAILED'
type ExecutionFlow = { id: string; name: string; events: Array<{ name: string; status: ExecutionStatus }>; finalStatus?: FinalFlowStatus; passedEvents?: number; failedEvents?: number }

const statusText: Record<ExecutionStatus, string> = { passed: 'Passed', pending: 'Pending', failed: 'Failed' }

function StatusIcon({ status }: { status: ExecutionStatus }) {
  if (status === 'passed') return <Check size={18} />
  if (status === 'failed') return <span>×</span>
  return <span className="status-center" />
}

function formatStep(index: number) {
  return index > 999 ? '999+' : String(index).padStart(2, '0')
}

function formatMetric(value: number) {
  return new Intl.NumberFormat('en', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

function ExecutionCard({ flow, active, selectionLocked, onClick, onDelete }: { flow: ExecutionFlow; active: boolean; selectionLocked: boolean; onClick: () => void; onDelete: () => void }) {
  const initialStep = 0
  const [selectedStep, setSelectedStep] = useTabState('execution', `selectedStep:${flow.id}`, initialStep)
  const selectedEvent = flow.events[selectedStep]
  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() }
  }
  return (
    <article className={`execution-card ${active ? 'selected' : ''}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyboard}>
      <div className="execution-card-head"><h3>{flow.name} <small>#{flow.id}</small></h3>{flow.finalStatus && <span className={`flow-final-status ${flow.finalStatus.toLowerCase()}`}>{flow.finalStatus}{flow.finalStatus === 'PARTIAL' && ` · ${flow.passedEvents} passed / ${flow.failedEvents} failed`}</span>}<button className="execution-delete" disabled={selectionLocked} aria-label={`Remove ${flow.name}`} title={selectionLocked ? 'Stop validation before removing flows' : 'Remove flow'} onClick={(event) => { event.stopPropagation(); onDelete() }}><Trash2 /></button></div>
      <div className="timeline-scroll">
        <div className="timeline">
          {flow.events.map((event, index) => <button className={`timeline-step ${event.status} ${selectedStep === index ? 'active' : ''}`} key={event.name} aria-label={`Step ${index + 1}: ${event.name}`} onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedStep(index); onClick() }}>
            <span className="node">{formatStep(index + 1)}</span>{index < flow.events.length - 1 && <i />}
          </button>)}
        </div>
      </div>
      <div className="execution-card-helper"><ListTree /><span>Selected step:</span><strong>{formatStep(selectedStep + 1)}</strong><b>{selectedEvent?.name}</b><i /><Info /><span>Hover / click to inspect event details</span></div>
    </article>
  )
}

export function FlowExecution({ websocket }: { websocket: EventDeckWebSocket | null }) {
  const navigate = useNavigate()
  const liveStreamState = useLiveStreamStore((state) => state.runtime.streamState)
  const [selectedId, setSelectedId] = useTabState('execution', 'selectedId', '')
  const [visibleFlows, setVisibleFlows] = useTabState<ExecutionFlow[]>('execution', 'visibleFlows', [])
  const [availableFlows, setAvailableFlows] = useTabState<Flow[]>('execution', 'availableFlows', [])
  const [selectedData, setSelectedData] = useTabState<SelectedFlow[]>('execution', 'selectedData', [])
  const [recordings, setRecordings] = useTabState<Array<{ id: string; name: string; status: string }>>('execution', 'recordings', [])
  const [source, setSource] = useTabState('execution', 'source', 'live')
  const [message, setMessage] = useTabState('execution', 'message', 'Loading selected flows…')
  const [validationState, setValidationState] = useTabState<'running' | 'paused' | 'stopped'>('execution', 'validationState', 'stopped')
  const [flowSelectorOpen, setFlowSelectorOpen] = useTabState('execution', 'flowSelectorOpen', false)
  const [flowQuery, setFlowQuery] = useTabState('execution', 'flowQuery', '')
  const [draftFlowIds, setDraftFlowIds] = useTabState<string[]>('execution', 'draftFlowIds', [])
  const [flowSelectorError, setFlowSelectorError] = useTabState('execution', 'flowSelectorError', '')
  const [executionError, setExecutionError] = useTabState('execution', 'executionError', '')
  const [resultsOpen, setResultsOpen] = useTabState('execution', 'resultsOpen', false)
  const [graphicalResults, setGraphicalResults] = useTabState('execution', 'graphicalResults', false)
  const selected = visibleFlows.find((flow) => flow.id === selectedId)
  const draftFlowIdSet = useMemo(() => new Set(draftFlowIds), [draftFlowIds])
  const filteredAvailableFlows = useMemo(() => availableFlows.filter((flow) => flow.name.toLowerCase().includes(flowQuery.toLowerCase())), [availableFlows, flowQuery])
  const counts = useMemo(() => selected?.events.reduce((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), { passed: 0, pending: 0, failed: 0 }) ?? { passed: 0, pending: 0, failed: 0 }, [selected])
  const completedFlows = useMemo(() => visibleFlows.filter((flow) => flow.finalStatus), [visibleFlows])
  const resultTotals = useMemo(() => completedFlows.reduce((totals, flow) => ({
    flows: totals.flows + 1,
    passedFlows: totals.passedFlows + (flow.finalStatus === 'PASSED' ? 1 : 0),
    partialFlows: totals.partialFlows + (flow.finalStatus === 'PARTIAL' ? 1 : 0),
    failedFlows: totals.failedFlows + (flow.finalStatus === 'FAILED' ? 1 : 0),
    passedEvents: totals.passedEvents + (flow.passedEvents ?? 0),
    failedEvents: totals.failedEvents + (flow.failedEvents ?? 0),
  }), { flows: 0, passedFlows: 0, partialFlows: 0, failedFlows: 0, passedEvents: 0, failedEvents: 0 }), [completedFlows])
  const mapFlows = (flows: SelectedFlow[], state?: ExecutionState, completed?: Completion): ExecutionFlow[] => {
    const runtimeByFlow = new Map(state?.flows.map((flow) => [flow.flowId, flow]) ?? [])
    const completedByFlow = new Map(completed?.flows.map((flow) => [flow.flowId, flow]) ?? [])
    return flows.map((flow) => {
      const runtime = runtimeByFlow.get(flow.flowId)
      const final = completedByFlow.get(flow.flowId)
      return {
        id: flow.flowId,
        name: flow.name,
        events: flow.events.map((event, index) => ({ name: event.eventDefinitionName, status: final?.events[index]?.status === 'PASSED' || runtime?.events[index]?.status === 'PASSED' ? 'passed' : final?.events[index]?.status === 'FAILED' || runtime?.events[index]?.status === 'FAILED' ? 'failed' : 'pending' })),
        ...(final ? { finalStatus: final.status, passedEvents: final.passedEvents, failedEvents: final.failedEvents } : {}),
      }
    })
  }
  const refresh = async () => { try { const [saved, all, sessions, state] = await Promise.all([api.selectedFlows(), api.flows(), api.recordings(), api.execution()]); setSelectedData(saved); setAvailableFlows(all); setRecordings(sessions); const mapped = mapFlows(saved, state, state.completion ?? undefined); setVisibleFlows(mapped); setSelectedId((current) => mapped.some((flow) => flow.id === current) ? current : ''); setValidationState(state.active ? 'running' : 'stopped'); setMessage('') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load flow execution.') } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => websocket?.subscribe((event) => {
    if (event.type === 'flow_execution.started') { setExecutionError(''); setResultsOpen(false); setValidationState('running'); setVisibleFlows(mapFlows(selectedData, { active: true, flows: (event.payload as { flows: ExecutionState['flows'] }).flows })) }
    else if (event.type === 'flow_execution.event_definition_passed') {
      const affected = (event.payload as { affectedFlows: Array<{ flowId: string; flowIndex: number; eventIndex: number }> }).affectedFlows
      setVisibleFlows((current) => {
        const next = [...current]
        for (const reference of affected) {
          const flowIndex = next[reference.flowIndex]?.id === reference.flowId ? reference.flowIndex : next.findIndex((flow) => flow.id === reference.flowId)
          if (flowIndex < 0 || !next[flowIndex].events[reference.eventIndex]) continue
          const flow = next[flowIndex]
          const events = [...flow.events]
          events[reference.eventIndex] = { ...events[reference.eventIndex], status: 'passed' }
          next[flowIndex] = { ...flow, events }
        }
        return next
      })
    } else if (event.type === 'flow_execution.reset') {
      setExecutionError('')
      setResultsOpen(false)
      setValidationState('stopped')
      setVisibleFlows(mapFlows(selectedData, { active: false, flows: (event.payload as { flows: ExecutionState['flows'] }).flows }))
    } else if (event.type === 'flow_execution.validation_error') {
      const payload = event.payload as { message?: string; eventDefinitionId?: string }
      setExecutionError(`${payload.message ?? 'Flow validation failed.'}${payload.eventDefinitionId ? ` Event definition: ${payload.eventDefinitionId}.` : ''}`)
    } else if (event.type === 'flow_execution.validation_completed') { setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, undefined, event.payload as Completion)) }
  }), [websocket, selectedData])
  const openFlowSelector = () => { setDraftFlowIds(selectedData.map((flow) => flow.flowId)); setFlowQuery(''); setFlowSelectorError(''); setFlowSelectorOpen(true) }
  const toggleDraftFlow = (flowId: string) => setDraftFlowIds((current) => current.includes(flowId) ? current.filter((id) => id !== flowId) : [...current, flowId])
  const saveFlowSelection = async () => {
    try {
      const saved = await api.replaceSelectedFlows(draftFlowIds)
      const mapped = mapFlows(saved)
      setSelectedData(saved)
      setVisibleFlows(mapped)
      setSelectedId((current) => mapped.some((flow) => flow.id === current) ? current : '')
      setMessage('')
      setFlowSelectorOpen(false)
    } catch (cause) { setFlowSelectorError(cause instanceof Error ? cause.message : 'Could not save selected flows.') }
  }
  const removeFlow = async (flowId: string) => { if (validationState !== 'stopped') return; try { const saved = await api.replaceSelectedFlows(selectedData.filter((flow) => flow.flowId !== flowId).map((flow) => flow.flowId)); setSelectedData(saved); const mapped = mapFlows(saved); setVisibleFlows(mapped); if (selectedId === flowId) setSelectedId('') } catch (cause) { setExecutionError(cause instanceof Error ? cause.message : 'Could not remove flow.') } }
  const start = async () => { try { setExecutionError(''); setResultsOpen(false); const result = await api.validate(source === 'live' ? undefined : source); if ('status' in result) { setValidationState('running'); setVisibleFlows(mapFlows(selectedData, { active: true, flows: result.flows })) } else { setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, undefined, result)) } } catch (cause) { setExecutionError(cause instanceof Error ? cause.message : 'Could not start validation.') } }
  const stop = async () => { try { const result = await api.stopValidation(); setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, undefined, result)) } catch (cause) { setExecutionError(cause instanceof Error ? cause.message : 'Could not stop validation.') } }
  const reset = async () => { try { setExecutionError(''); setResultsOpen(false); const result = await api.resetValidation(); setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, { active: false, flows: result.flows })) } catch (cause) { setExecutionError(cause instanceof Error ? cause.message : 'Could not reset validation.') } }
  return (
    <div className="screen execution-screen">
      <div className="execution-top-view">
        <PageHeader title="Flow Execution" description="Validate and execute your event flows to ensure events are received in the correct order." />
        <section className="flow-execution-controls" aria-label="Flow Execution Controls">
          <div className="flow-controls-head">
            <span className="flow-controls-title">Flow Execution Controls</span>
            {validationState !== 'stopped' && <span className={`validation-indicator ${validationState}`} aria-live="polite">
              {validationState === 'running' ? <LoaderCircle /> : <Pause />}
              {validationState === 'running' ? 'Validating' : 'Paused'}
            </span>}
          </div>
          <div className="flow-control-row">
            <button className="flow-control-item" aria-label="Select flows" data-tooltip={validationState === 'stopped' ? 'Select flows for validation' : 'Stop validation before changing flows'} disabled={validationState !== 'stopped'} onClick={openFlowSelector}><Plus /></button>
            <button className="flow-control-item primary" aria-label="Start validation" data-tooltip="Start validating selected flows" disabled={validationState === 'running' || !visibleFlows.length} onClick={() => void start()}>
              <Play fill="currentColor" />
            </button>
            <button className="flow-control-item" aria-label="Stop validation" data-tooltip="Stop the current validation" disabled={validationState === 'stopped'} onClick={() => void stop()}><Square fill="currentColor" /></button>
            <button className="flow-control-item" aria-label="Reset validation status" data-tooltip={validationState === 'stopped' ? 'Reset every event to Pending' : 'Stop validation before resetting'} disabled={validationState !== 'stopped' || !visibleFlows.length} onClick={() => void reset()}><RotateCcw /></button>
            <i className="flow-control-divider" />
            <label className="execution-source"><strong>Source</strong><Select disabled={validationState !== 'stopped'} value={source} onChange={(event) => setSource(event.target.value)}><option value="live">Live Stream · {liveStreamState}</option>{recordings.filter((item) => item.status === 'COMPLETED').map((item) => <option key={item.id} value={item.id}>Recorded · {item.name}</option>)}</Select></label>
          </div>
        </section>
      </div>
      <div className="execution-top-divider" />
      <div className={`execution-grid execution-bottom-view ${selected ? 'details-open' : 'details-closed'}`}>
        <Panel className="selected-flows"><div className="selected-flows-header"><div><h2>Selected Flows ({visibleFlows.length})</h2><p>View and monitor the execution status of your event flows.</p></div><Button className="all-results-button" disabled={validationState !== 'stopped' || completedFlows.length === 0} title={validationState !== 'stopped' ? 'Results are available after validation stops' : completedFlows.length === 0 ? 'Run validation to generate results' : 'View combined validation results'} onClick={() => { setGraphicalResults(false); setResultsOpen(true) }}><BarChart3 />All Results</Button></div>{message ? <div className="empty-list" role="status">{message}</div> : visibleFlows.length ? <VirtualList className="execution-flow-list" items={visibleFlows} estimateSize={220} getKey={(flow) => flow.id} renderItem={(flow) => <ExecutionCard flow={flow} active={flow.id === selectedId} selectionLocked={validationState !== 'stopped'} onClick={() => setSelectedId(flow.id)} onDelete={() => void removeFlow(flow.id)} />} /> : <section className="execution-empty-state" aria-labelledby="execution-empty-title">
          <div className="execution-empty-visual" aria-hidden="true"><span className="execution-empty-node start"><GitBranch /></span><i /><span className="execution-empty-node play"><Play fill="currentColor" /></span><i /><span className="execution-empty-node result"><Check /></span></div>
          <span className="feature-empty-eyebrow">Validation workspace</span><h3 id="execution-empty-title">{availableFlows.length ? 'Select flows to begin validation' : 'Build a flow before you validate'}</h3>
          <p>{availableFlows.length ? 'Choose one or more saved flows, select an event source, and monitor every validation step in real time.' : 'Flow Execution uses saved Build Flows. Create your first flow, then return here to validate its event sequence.'}</p>
          <div className="feature-empty-steps"><span><b>1</b>Select flows</span><i /><span><b>2</b>Choose source</span><i /><span><b>3</b>Run validation</span></div>
          {availableFlows.length ? <Button variant="primary" disabled={validationState !== 'stopped'} onClick={openFlowSelector}><Plus />Select Flows</Button> : <Button variant="primary" onClick={() => navigate('/build-flow')}><GitBranch />Go to Build Flows<ArrowRight /></Button>}
        </section>}</Panel>
        {selected && <Panel className="execution-details">
          <><div className="execution-title">
            <div className="execution-title-row"><div><h2>Selected Flow Details</h2><p>Real-time execution details and event status for this flow.</p></div><IconButton bare label="Close selected flow details" onClick={() => setSelectedId('')}><X size={19} /></IconButton></div>
            <div className="status-summary">
              <div tabIndex={0} aria-label={`Passed: ${counts.passed.toLocaleString()}`} data-tooltip={`Passed: ${counts.passed.toLocaleString()}`}><span className="summary-icon passed"><Check /></span><strong>{formatMetric(counts.passed)}</strong></div>
              <div tabIndex={0} aria-label={`Pending: ${counts.pending.toLocaleString()}`} data-tooltip={`Pending: ${counts.pending.toLocaleString()}`}><span className="summary-icon pending"><Circle /></span><strong>{formatMetric(counts.pending)}</strong></div>
              <div tabIndex={0} aria-label={`Failed: ${counts.failed.toLocaleString()}`} data-tooltip={`Failed: ${counts.failed.toLocaleString()}`}><span className="summary-icon failed"><CircleX /></span><strong>{formatMetric(counts.failed)}</strong></div>
            </div>
          </div>
          <div className="execution-events-section">
            <h3 className="events-title">Events in this Flow ({selected.events.length})</h3>
            <div className="execution-table"><div className="execution-table-head"><span>#</span><span>Event Name / Alias</span><span>Status</span></div><VirtualList className="execution-table-body" items={selected.events} estimateSize={46} getKey={(event, index) => `${index}:${event.name}`} renderItem={(event, index) => <div className="execution-table-row"><span>{String(index + 1).padStart(2, '0')}</span><strong>{event.name}</strong><span className={`status-badge ${event.status}`} aria-label={statusText[event.status]} title={statusText[event.status]}><StatusIcon status={event.status} /></span></div>} /></div>
          </div></>
        </Panel>}
      </div>
      {executionError && <div className="app-toast error" role="alert"><strong>Flow validation error</strong><span>{executionError}</span><button aria-label="Dismiss error" onClick={() => setExecutionError('')}>×</button></div>}
      {resultsOpen && completedFlows.length > 0 && <Modal className="validation-results-modal" title="Validation Results" onClose={() => setResultsOpen(false)} actions={<><Button onClick={() => setGraphicalResults((current) => !current)}><BarChart3 />{graphicalResults ? 'Structured View' : 'Graphical View'}</Button><Button variant="primary" onClick={() => setResultsOpen(false)}>Close</Button></>}>
        <div className="validation-results-summary" aria-label="Combined validation summary">
          <div><small>Flows</small><strong>{resultTotals.flows}</strong></div>
          <div className="passed"><small>Passed</small><strong>{resultTotals.passedFlows}</strong></div>
          <div className="partial"><small>Partial</small><strong>{resultTotals.partialFlows}</strong></div>
          <div className="failed"><small>Failed</small><strong>{resultTotals.failedFlows}</strong></div>
        </div>
        <p className="validation-event-total"><strong>{resultTotals.passedEvents}</strong> passed events · <strong>{resultTotals.failedEvents}</strong> failed events</p>
        {graphicalResults ? <div className="validation-results-chart" role="img" aria-label="Graphical validation results">
          <section><h3>Flow outcomes</h3><div className="result-stacked-bar" aria-label={`${resultTotals.passedFlows} passed, ${resultTotals.partialFlows} partial, ${resultTotals.failedFlows} failed flows`}><i className="passed" style={{ width: `${resultTotals.flows ? resultTotals.passedFlows / resultTotals.flows * 100 : 0}%` }} /><i className="partial" style={{ width: `${resultTotals.flows ? resultTotals.partialFlows / resultTotals.flows * 100 : 0}%` }} /><i className="failed" style={{ width: `${resultTotals.flows ? resultTotals.failedFlows / resultTotals.flows * 100 : 0}%` }} /></div><div className="result-chart-legend"><span className="passed">Passed {resultTotals.passedFlows}</span><span className="partial">Partial {resultTotals.partialFlows}</span><span className="failed">Failed {resultTotals.failedFlows}</span></div></section>
          <section className="result-flow-bars"><h3>Events by flow</h3><VirtualList className="result-flow-bars-list" items={completedFlows} estimateSize={48} getKey={(flow) => flow.id} renderItem={(flow) => { const total = (flow.passedEvents ?? 0) + (flow.failedEvents ?? 0); return <div className="result-flow-bar"><div><strong>{flow.name}</strong><small>{flow.passedEvents ?? 0} passed · {flow.failedEvents ?? 0} failed</small></div><div className="result-stacked-bar"><i className="passed" style={{ width: `${total ? (flow.passedEvents ?? 0) / total * 100 : 0}%` }} /><i className="failed" style={{ width: `${total ? (flow.failedEvents ?? 0) / total * 100 : 0}%` }} /></div></div> }} /></section>
        </div> : <VirtualList className="validation-results-list" items={completedFlows} estimateSize={150} getKey={(flow) => flow.id} renderItem={(flow) => <article className="validation-result-flow">
          <header><div><h3>{flow.name}</h3><small>#{flow.id}</small></div><span className={`flow-final-status ${flow.finalStatus?.toLowerCase()}`}>{flow.finalStatus}</span></header>
          <div className="validation-result-counts"><span><Check />{flow.passedEvents ?? 0} passed</span><span><CircleX />{flow.failedEvents ?? 0} failed</span></div>
          <div className="validation-result-events">{flow.events.map((event, index) => <span key={`${index}:${event.name}`} className={event.status}><b>{index + 1}</b>{event.name}<StatusIcon status={event.status} /></span>)}</div>
        </article>} />}
      </Modal>}
      {flowSelectorOpen && <Modal className="flow-selector-modal" title="Select Flows" onClose={() => setFlowSelectorOpen(false)} actions={<><Button onClick={() => setFlowSelectorOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => void saveFlowSelection()}>Save</Button></>}>
        <label className="search-field flow-selector-search"><Search size={19} /><Input autoFocus value={flowQuery} onChange={(event) => setFlowQuery(event.target.value)} placeholder="Search created flows..." /></label>
        {flowSelectorError && <div className="flow-selector-error" role="alert">{flowSelectorError}</div>}
        {filteredAvailableFlows.length > 0 ? <VirtualList className="flow-selector-list" items={filteredAvailableFlows} estimateSize={70} getKey={(flow) => flow.id} renderItem={(flow) => {
            const checked = draftFlowIdSet.has(flow.id)
            return <div className={`flow-selector-row ${checked ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => toggleDraftFlow(flow.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleDraftFlow(flow.id) } }}>
              <span onClick={(event) => event.stopPropagation()}><Checkbox label={`Select ${flow.name}`} checked={checked} onChange={() => toggleDraftFlow(flow.id)} /></span>
              <strong>{flow.name}</strong>
              <span className="event-pill">{flow.events.length} events</span>
            </div>
          }} /> : <div className="flow-selector-list"><div className="flow-selector-empty">No created flows found.</div></div>}
      </Modal>}
    </div>
  )
}
