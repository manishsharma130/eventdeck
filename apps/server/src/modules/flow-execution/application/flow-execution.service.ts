import { AppError } from '../../../shared/errors/app-error.js'
import type { WebSocketGateway } from '../../../websocket/websocket.types.js'
import { compileDefinition, matchesDefinition, type CompiledEventDefinition } from '../../event-rules/domain/event-rule.matcher.js'
import type { LiveEvent } from '../../event-rules/domain/event-rule.types.js'
import type { LiveEventBus } from '../../live-stream/application/live-event-bus.js'
import type { DefinitionPassedUpdate, ExecutionEventStatus, ExecutionStopReason, FlowReference, SelectedFlow, ValidationCompleted } from '../domain/flow-execution.types.js'
import type { FlowSelectionService } from './flow-selection.service.js'

type RuntimeDefinition = { definition: CompiledEventDefinition; passed: boolean; flowReferences: FlowReference[] }
type RuntimeFlow = Omit<SelectedFlow, 'events'> & { flowIndex: number; events: Array<SelectedFlow['events'][number] & { status: ExecutionEventStatus }> }
type ExecutionContext = { active: boolean; eventIndex: Map<string, RuntimeDefinition[]>; flows: RuntimeFlow[] }

export class FlowExecutionService {
  private context: ExecutionContext | null = null
  constructor(private readonly selection: FlowSelectionService, private readonly websocket: WebSocketGateway, eventBus: LiveEventBus) {
    eventBus.subscribe((event) => this.handleEvent(event))
  }
  getState(): { active: boolean; flows: RuntimeFlow[] } { return { active: this.context?.active ?? false, flows: this.context?.flows ?? [] } }
  start(): { status: 'started'; flows: RuntimeFlow[] } {
    if (this.context?.active) throw new AppError('VALIDATION_ALREADY_ACTIVE', 'Flow validation is already active.', 409)
    const selected = this.selection.getSelected()
    if (selected.length === 0) throw new AppError('NO_FLOWS_SELECTED', 'Select at least one flow before validation.', 400)
    const flows: RuntimeFlow[] = selected.map((flow, flowIndex) => ({ ...flow, flowIndex, events: flow.events.map((event) => ({ ...event, status: 'PENDING' })) }))
    const definitions = new Map<string, RuntimeDefinition>()
    for (const flow of flows) for (const [eventIndex, event] of flow.events.entries()) {
      const existing = definitions.get(event.eventDefinitionId)
      const reference = { flowId: flow.flowId, flowIndex: flow.flowIndex, flowEventId: event.flowEventId, eventIndex }
      if (existing) existing.flowReferences.push(reference)
      else definitions.set(event.eventDefinitionId, {
        definition: compileDefinition({ id: event.eventDefinitionId, name: event.eventDefinitionName, eventValue: event.eventName, rules: event.rules, createdAt: 0, updatedAt: 0 }),
        passed: false, flowReferences: [reference],
      })
    }
    const eventIndex = new Map<string, RuntimeDefinition[]>()
    for (const runtime of definitions.values()) eventIndex.set(runtime.definition.eventValue, [...(eventIndex.get(runtime.definition.eventValue) ?? []), runtime])
    this.context = { active: true, eventIndex, flows }
    const result = { status: 'started' as const, flows }
    this.websocket.broadcast('flow_execution.started', result)
    return result
  }
  handleEvent(event: LiveEvent): DefinitionPassedUpdate[] {
    if (!this.context?.active) return []
    const updates: DefinitionPassedUpdate[] = []
    try {
      for (const runtime of this.context.eventIndex.get(event.eventName) ?? []) {
        if (runtime.passed || !matchesDefinition(event, runtime.definition)) continue
        runtime.passed = true
        for (const reference of runtime.flowReferences) this.context.flows[reference.flowIndex].events[reference.eventIndex].status = 'PASSED'
        const update: DefinitionPassedUpdate = {
          type: 'flow_execution.event_definition_passed', eventDefinitionId: runtime.definition.id, eventName: runtime.definition.eventValue, affectedFlows: runtime.flowReferences,
        }
        updates.push(update)
        this.websocket.broadcast(update.type, { eventDefinitionId: update.eventDefinitionId, eventName: update.eventName, affectedFlows: update.affectedFlows })
      }
    } catch (error) {
      this.websocket.broadcast('flow_execution.validation_error', { message: error instanceof Error ? error.message : String(error) })
    }
    return updates
  }
  stop(reason: ExecutionStopReason = 'USER_STOPPED'): ValidationCompleted {
    if (!this.context?.active) throw new AppError('VALIDATION_NOT_ACTIVE', 'Flow validation is not active.', 409)
    this.context.active = false
    const result: ValidationCompleted = {
      type: 'flow_execution.validation_completed', reason,
      flows: this.context.flows.map((flow) => {
        for (const event of flow.events) if (event.status === 'PENDING') event.status = 'FAILED'
        const passedEvents = flow.events.filter((event) => event.status === 'PASSED').length
        const totalEvents = flow.events.length
        const failedEvents = totalEvents - passedEvents
        return {
          flowId: flow.flowId, flowIndex: flow.flowIndex, name: flow.name, totalEvents, passedEvents, failedEvents,
          status: totalEvents > 0 && passedEvents === totalEvents ? 'PASSED' : passedEvents === 0 ? 'FAILED' : 'PARTIAL',
          events: flow.events.map((event, eventIndex) => ({ flowEventId: event.flowEventId, eventDefinitionId: event.eventDefinitionId, eventIndex, status: event.status as 'PASSED' | 'FAILED' })),
        }
      }),
    }
    this.websocket.broadcast(result.type, { reason: result.reason, flows: result.flows })
    return result
  }
}
