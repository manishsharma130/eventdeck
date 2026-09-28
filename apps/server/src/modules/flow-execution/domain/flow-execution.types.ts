import type { EventRuleCondition, LiveEvent } from '../../event-rules/domain/event-rule.types.js'

export type SelectedFlow = {
  flowId: string; name: string; position: number
  events: Array<{ flowEventId: string; eventDefinitionId: string; eventName: string; eventDefinitionName: string; position: number; rules: EventRuleCondition[] }>
}
export type FlowReference = { flowId: string; flowIndex: number; flowEventId: string; eventIndex: number }
export type ExecutionEventStatus = 'PENDING' | 'PASSED' | 'FAILED'
export type ExecutionStopReason = 'USER_STOPPED' | 'SOURCE_COMPLETED' | 'EXECUTION_ERROR'
export type DefinitionPassedUpdate = { type: 'flow_execution.event_definition_passed'; eventDefinitionId: string; eventName: string; affectedFlows: FlowReference[] }
export type ValidationCompleted = {
  type: 'flow_execution.validation_completed'; reason: ExecutionStopReason
  flows: Array<{
    flowId: string; flowIndex: number; name: string; totalEvents: number; passedEvents: number; failedEvents: number; status: 'PASSED' | 'PARTIAL' | 'FAILED'
    events: Array<{ flowEventId: string; eventDefinitionId: string; eventIndex: number; status: Exclude<ExecutionEventStatus, 'PENDING'> }>
  }>
}
export type ExecutionInputEvent = LiveEvent
