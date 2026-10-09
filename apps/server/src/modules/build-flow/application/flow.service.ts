import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors/app-error.js'
import type { EventRuleRepository } from '../../event-rules/application/event-rule.repository.js'
import type { Flow, FlowInput } from '../domain/flow.types.js'
import type { FlowRepository } from './flow.repository.js'

export class FlowService {
  constructor(
    private readonly repository: FlowRepository,
    private readonly eventRules: EventRuleRepository,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID,
  ) {}
  list(search?: string): Flow[] { return this.repository.list(search) }
  get(id: string): Flow {
    const flow = this.repository.findById(id)
    if (!flow) throw new AppError('FLOW_NOT_FOUND', 'Flow was not found.', 404)
    return flow
  }
  create(input: FlowInput): Flow {
    const validated = this.validate(input)
    this.ensureUniqueName(validated.name)
    const timestamp = this.now()
    const flowId = this.id()
    return this.repository.create({
      id: flowId, name: validated.name, createdAt: timestamp, updatedAt: timestamp,
      events: validated.eventDefinitionIds.map((eventDefinitionId, position) => ({ id: this.id(), flowId, eventDefinitionId, position })),
    })
  }
  update(id: string, input: FlowInput): Flow {
    const existing = this.get(id)
    const validated = this.validate(input)
    this.ensureUniqueName(validated.name, id)
    return this.repository.update({
      ...existing, name: validated.name, updatedAt: this.now(),
      events: validated.eventDefinitionIds.map((eventDefinitionId, position) => ({ id: this.id(), flowId: id, eventDefinitionId, position })),
    })
  }
  delete(id: string): { deleted: true } { this.get(id); this.repository.delete(id); return { deleted: true } }
  deleteMany(ids: string[]): { deleted: number } { return { deleted: this.repository.deleteMany(ids) } }

  private validate(input: FlowInput): FlowInput {
    const name = input.name.trim()
    if (!name) throw new AppError('INVALID_FLOW', 'Flow name is required.', 400)
    if (input.eventDefinitionIds.length === 0) throw new AppError('INVALID_FLOW', 'A flow must contain at least one event definition.', 400)
    if (new Set(input.eventDefinitionIds).size !== input.eventDefinitionIds.length) throw new AppError('DUPLICATE_FLOW_EVENT', 'The same event definition cannot appear more than once in a flow.', 400)
    for (const id of input.eventDefinitionIds) if (!this.eventRules.findById(id)) throw new AppError('EVENT_DEFINITION_NOT_FOUND', `Event definition '${id}' was not found.`, 400)
    return { name, eventDefinitionIds: input.eventDefinitionIds }
  }
  private ensureUniqueName(name: string, excludingId?: string): void {
    const existing = this.repository.findByName(name)
    if (existing && existing.id !== excludingId) throw new AppError('FLOW_NAME_ALREADY_EXISTS', `A flow with the name '${name}' already exists.`, 409, { existingFlowId: existing.id })
  }
}
