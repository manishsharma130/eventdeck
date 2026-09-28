import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors/app-error.js'
import { normalizeDefinition } from '../domain/event-rule-normalizer.js'
import { createRuleSignature } from '../domain/event-rule-signature.js'
import type { EventDefinition, EventDefinitionInput } from '../domain/event-rule.types.js'
import type { EventRuleRepository } from './event-rule.repository.js'
import type { RuntimeEventRuleIndex } from './runtime-event-rule-index.js'

export class EventRuleService {
  constructor(
    private readonly repository: EventRuleRepository,
    private readonly index: RuntimeEventRuleIndex,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID,
  ) { this.index.rebuild(this.repository.list()) }

  list(): EventDefinition[] { return this.repository.list() }
  get(id: string): EventDefinition {
    const definition = this.repository.findById(id)
    if (!definition) throw new AppError('EVENT_DEFINITION_NOT_FOUND', 'Event definition was not found.', 404)
    return definition
  }

  create(input: EventDefinitionInput): EventDefinition {
    const normalized = this.validate(input)
    this.ensureUnique(normalized)
    const timestamp = this.now()
    const definition: EventDefinition = {
      id: this.id(), name: normalized.name, eventValue: normalized.eventValue,
      rules: normalized.rules.map((rule) => ({ id: this.id(), paramKey: rule.paramKey, matchType: rule.matchType, ...(rule.matchType === 'exists' ? {} : { expectedValue: rule.expectedValue }) })),
      createdAt: timestamp, updatedAt: timestamp,
    }
    this.repository.create(definition, createRuleSignature(normalized))
    this.index.upsert(definition)
    return definition
  }

  update(id: string, input: EventDefinitionInput): EventDefinition {
    const existing = this.get(id)
    const normalized = this.validate(input)
    this.ensureUnique(normalized, id)
    const definition: EventDefinition = {
      ...existing, name: normalized.name, eventValue: normalized.eventValue, updatedAt: this.now(),
      rules: normalized.rules.map((rule) => ({ id: this.id(), paramKey: rule.paramKey, matchType: rule.matchType, ...(rule.matchType === 'exists' ? {} : { expectedValue: rule.expectedValue }) })),
    }
    this.repository.update(definition, createRuleSignature(normalized))
    this.index.upsert(definition)
    return definition
  }

  delete(id: string): { deleted: true; affectedFlows: number } {
    this.get(id)
    const affectedFlows = this.repository.countFlowReferences(id)
    this.repository.delete(id)
    this.index.remove(id)
    return { deleted: true, affectedFlows }
  }

  private validate(input: EventDefinitionInput): ReturnType<typeof normalizeDefinition> {
    const normalized = normalizeDefinition(input)
    if (!normalized.name || !normalized.eventValue) throw new AppError('INVALID_EVENT_DEFINITION', 'Event name and event value are required.', 400)
    for (const rule of normalized.rules) {
      if (!rule.paramKey) throw new AppError('INVALID_EVENT_RULE', 'Rule parameter key is required.', 400)
      if (rule.matchType !== 'exists' && !rule.expectedValue) throw new AppError('INVALID_EVENT_RULE', `Expected value is required for ${rule.matchType} rules.`, 400)
      if (rule.matchType === 'regex') {
        try { new RegExp(rule.expectedValue) } catch { throw new AppError('INVALID_EVENT_RULE_REGEX', `Invalid regular expression for '${rule.paramKey}'.`, 400) }
      }
    }
    return normalized
  }

  private ensureUnique(input: EventDefinitionInput, excludingId?: string): void {
    const byName = this.repository.findByName(input.name)
    if (byName && byName.id !== excludingId) throw new AppError('EVENT_NAME_ALREADY_EXISTS', `The event name '${input.name}' is already in use.`, 409, {
      field: 'name', existingEventId: byName.id, existingEventName: byName.name,
    })
    const duplicate = this.repository.findBySignature(createRuleSignature(input))
    if (duplicate && duplicate.id !== excludingId) throw new AppError('EVENT_DEFINITION_ALREADY_EXISTS', 'An event definition with the same event value and rules already exists.', 409, {
      existingEvent: { id: duplicate.id, name: duplicate.name, eventValue: duplicate.eventValue },
      matchingRules: duplicate.rules.map(({ paramKey, matchType, expectedValue }) => ({ paramKey, matchType, ...(expectedValue === undefined ? {} : { expectedValue }) })),
    })
  }
}
