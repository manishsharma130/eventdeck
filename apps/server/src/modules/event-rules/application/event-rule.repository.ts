import type { EventDefinition } from '../domain/event-rule.types.js'

export interface EventRuleRepository {
  create(definition: EventDefinition, signature: string): EventDefinition
  update(definition: EventDefinition, signature: string): EventDefinition
  delete(id: string): boolean
  deleteMany(ids: string[]): number
  findById(id: string): EventDefinition | null
  findByName(name: string): EventDefinition | null
  findBySignature(signature: string): EventDefinition | null
  findManyByIds(ids: string[]): EventDefinition[]
  list(): EventDefinition[]
  countFlowReferences(id: string): number
  countFlowReferencesMany(ids: string[]): number
}
