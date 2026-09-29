import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Check, Circle, CircleX, GitBranch, Info, ListTree, LoaderCircle, Pause, Play, Plus, Square, Trash2 } from 'lucide-react'
import { Button, PageHeader, Panel, Select } from '../components/ui'
import { api, type Completion, type ExecutionState, type Flow, type SelectedFlow } from '../services/api'
import type { EventDeckWebSocket } from '../services/websocket'
import { useLiveStreamStore } from '../state/live-stream-store'

type ExecutionStatus = 'passed' | 'progress' | 'pending' | 'failed'
type ExecutionFlow = { id: string; name: string; events: Array<{ name: string; status: ExecutionStatus }> }

const statusText: Record<ExecutionStatus, string> = { passed: 'Passed', progress: 'In Progress', pending: 'Pending', failed: 'Failed' }

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

function ExecutionCard({ flow, active, onClick, onDelete }: { flow: ExecutionFlow; active: boolean; onClick: () => void; onDelete: () => void }) {
  const initialStep = Math.max(0, flow.events.findIndex((event) => event.status === 'progress'))
  const [selectedStep, setSelectedStep] = useState(initialStep)
  const selectedEvent = flow.events[selectedStep]
  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() }
  }
  return (
    <article className={`execution-card ${active ? 'selected' : ''}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyboard}>
      <div className="execution-card-head"><h3>{flow.name} <small>#{flow.id}</small></h3><button className="execution-delete" aria-label={`Remove ${flow.name}`} title="Remove flow" onClick={(event) => { event.stopPropagation(); onDelete() }}><Trash2 /></button></div>
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
  const liveStreamState = useLiveStreamStore((state) => state.runtime.streamState)
  const [selectedId, setSelectedId] = useState('')
  const [visibleFlows, setVisibleFlows] = useState<ExecutionFlow[]>([])
  const [availableFlows, setAvailableFlows] = useState<Flow[]>([])
  const [selectedData, setSelectedData] = useState<SelectedFlow[]>([])
  const [recordings, setRecordings] = useState<Array<{ id: string; name: string; status: string }>>([])
  const [source, setSource] = useState('live')
  const [message, setMessage] = useState('Loading selected flows…')
  const [validationState, setValidationState] = useState<'running' | 'paused' | 'stopped'>('stopped')
  const selected = visibleFlows.find((flow) => flow.id === selectedId) ?? visibleFlows[0]
  const counts = useMemo(() => selected?.events.reduce((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), { passed: 0, progress: 0, pending: 0, failed: 0 }) ?? { passed: 0, progress: 0, pending: 0, failed: 0 }, [selected])
  const mapFlows = (flows: SelectedFlow[], state?: ExecutionState, completed?: Completion): ExecutionFlow[] => flows.map((flow) => ({
    id: flow.flowId,
    name: flow.name,
    events: flow.events.map((event, index) => {
      const runtime = state?.flows.find((item) => item.flowId === flow.flowId)?.events[index]?.status
      const final = completed?.flows.find((item) => item.flowId === flow.flowId)?.events[index]?.status
      const status: ExecutionStatus = final === 'PASSED' || runtime === 'PASSED' ? 'passed' : final === 'FAILED' || runtime === 'FAILED' ? 'failed' : state?.active ? 'progress' : 'pending'
      return { name: event.eventDefinitionName, status }
    }),
  }))
  const refresh = async () => { try { const [saved, all, sessions, state] = await Promise.all([api.selectedFlows(), api.flows(), api.recordings(), api.execution()]); setSelectedData(saved); setAvailableFlows(all); setRecordings(sessions); const mapped = mapFlows(saved, state); setVisibleFlows(mapped); setSelectedId((current) => current || mapped[0]?.id || ''); setValidationState(state.active ? 'running' : 'stopped'); setMessage(saved.length ? '' : 'No flows selected.') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load flow execution.') } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => websocket?.subscribe((event) => {
    if (event.type === 'flow_execution.started') { setValidationState('running'); setVisibleFlows(mapFlows(selectedData, { active: true, flows: (event.payload as { flows: ExecutionState['flows'] }).flows })) }
    else if (event.type === 'flow_execution.event_definition_passed') { const affected = (event.payload as { affectedFlows: Array<{ flowId: string; eventIndex: number }> }).affectedFlows; setVisibleFlows((current) => current.map((flow) => ({ ...flow, events: flow.events.map((item, index) => affected.some((ref) => ref.flowId === flow.id && ref.eventIndex === index) ? { ...item, status: 'passed' } : item) }))) }
    else if (event.type === 'flow_execution.validation_completed') { setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, undefined, event.payload as Completion)) }
  }), [websocket, selectedData])
  const addFlow = async () => {
    const nextFlow = availableFlows.find((flow) => !selectedData.some((selectedFlow) => selectedFlow.flowId === flow.id))
    if (!nextFlow) return
    try { const saved = await api.replaceSelectedFlows([...selectedData.map((flow) => flow.flowId), nextFlow.id]); setSelectedData(saved); setVisibleFlows(mapFlows(saved)); setSelectedId(nextFlow.id); setMessage('') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not add flow.') }
  }
  const removeFlow = async (flowId: string) => { try { const saved = await api.replaceSelectedFlows(selectedData.filter((flow) => flow.flowId !== flowId).map((flow) => flow.flowId)); setSelectedData(saved); const mapped = mapFlows(saved); setVisibleFlows(mapped); if (selectedId === flowId) setSelectedId(mapped[0]?.id ?? '') } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not remove flow.') } }
  const start = async () => { try { const result = await api.validate(source === 'live' ? undefined : source); if ('status' in result) { setValidationState('running'); setVisibleFlows(mapFlows(selectedData, { active: true, flows: result.flows })) } else { setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, undefined, result)) } } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not start validation.') } }
  const stop = async () => { try { const result = await api.stopValidation(); setValidationState('stopped'); setVisibleFlows(mapFlows(selectedData, undefined, result)) } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not stop validation.') } }
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
            <button className="flow-control-item" aria-label="Add flow" data-tooltip="Add a flow to validation" onClick={addFlow}><Plus /></button>
            <button className="flow-control-item primary" aria-label="Start validation" data-tooltip="Start validating selected flows" disabled={validationState === 'running' || !visibleFlows.length} onClick={() => void start()}>
              <Play fill="currentColor" />
            </button>
            <button className="flow-control-item" aria-label="Stop validation" data-tooltip="Stop the current validation" disabled={validationState === 'stopped'} onClick={() => void stop()}><Square fill="currentColor" /></button>
            <i className="flow-control-divider" />
            <label className="execution-source"><strong>Source</strong><Select value={source} onChange={(event) => setSource(event.target.value)}><option value="live">Live Stream · {liveStreamState}</option>{recordings.filter((item) => item.status === 'COMPLETED').map((item) => <option key={item.id} value={item.id}>Recorded · {item.name}</option>)}</Select></label>
          </div>
        </section>
      </div>
      <div className="execution-top-divider" />
      <div className="execution-grid execution-bottom-view">
        <Panel className="selected-flows"><div className="selected-flows-header"><h2>Selected Flows ({visibleFlows.length})</h2><p>View and monitor the execution status of your event flows.</p></div>{message && <div className="empty-list" role="status">{message}</div>}{visibleFlows.length ? visibleFlows.map((flow) => <ExecutionCard key={flow.id} flow={flow} active={flow.id === selectedId} onClick={() => setSelectedId(flow.id)} onDelete={() => void removeFlow(flow.id)} />) : <div className="flow-empty-state"><span className="flow-empty-icon"><GitBranch /></span><h3>No flows selected</h3><p>Add a saved flow to begin validation. Create flows in the <strong>Build Flow</strong> tab, then use the Plus control here to add them.</p><Button variant="primary" onClick={() => void addFlow()}><Plus />Add Flow</Button></div>}</Panel>
        <Panel className="execution-details">
          {selected ? <><div className="execution-title">
            <div className="execution-title-row"><div><h2>Selected Flow Details</h2><p>Real-time execution details and event status for this flow.</p></div><Select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>{visibleFlows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</Select></div>
            <div className="status-summary">
              <div tabIndex={0} aria-label={`Passed: ${counts.passed.toLocaleString()}`} data-tooltip={`Passed: ${counts.passed.toLocaleString()}`}><span className="summary-icon passed"><Check /></span><strong>{formatMetric(counts.passed)}</strong></div>
              <div tabIndex={0} aria-label={`In Progress: ${counts.progress.toLocaleString()}`} data-tooltip={`In Progress: ${counts.progress.toLocaleString()}`}><span className="summary-icon progress"><Circle /></span><strong>{formatMetric(counts.progress)}</strong></div>
              <div tabIndex={0} aria-label={`Pending: ${counts.pending.toLocaleString()}`} data-tooltip={`Pending: ${counts.pending.toLocaleString()}`}><span className="summary-icon pending"><Circle /></span><strong>{formatMetric(counts.pending)}</strong></div>
              <div tabIndex={0} aria-label={`Failed: ${counts.failed.toLocaleString()}`} data-tooltip={`Failed: ${counts.failed.toLocaleString()}`}><span className="summary-icon failed"><CircleX /></span><strong>{formatMetric(counts.failed)}</strong></div>
            </div>
          </div>
          <div className="execution-events-section">
            <h3 className="events-title">Events in this Flow ({selected.events.length})</h3>
            <div className="execution-table"><div className="execution-table-head"><span>#</span><span>Event Name / Alias</span><span>Status</span></div><div className="execution-table-body">{selected.events.map((event, index) => <div className="execution-table-row" key={event.name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{event.name}</strong><span className={`status-badge ${event.status}`} aria-label={statusText[event.status]} title={statusText[event.status]}><StatusIcon status={event.status} /></span></div>)}</div></div>
          </div></> : <div className="details-empty-state"><GitBranch /><h3>No flow details yet</h3><p>Add a flow to inspect its events and validation status.</p></div>}
        </Panel>
      </div>
    </div>
  )
}
