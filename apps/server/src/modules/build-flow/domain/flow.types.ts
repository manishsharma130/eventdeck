import type { EventDefinition } from '../../event-rules/domain/event-rule.types.js'

export type FlowEvent = { id: string; flowId: string; eventDefinitionId: string; position: number; definition?: EventDefinition }
export type Flow = { id: string; name: string; events: FlowEvent[]; createdAt: number; updatedAt: number }
export type FlowInput = { name: string; eventDefinitionIds: string[] }
