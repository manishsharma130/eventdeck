import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors/app-error.js'
import type { FlowRepository } from '../../build-flow/application/flow.repository.js'
import type { EventRuleRepository } from '../../event-rules/application/event-rule.repository.js'
import type { SelectedFlow } from '../domain/flow-execution.types.js'
import type { SelectedFlowRepository } from './selected-flow.repository.js'

export class FlowSelectionService {
  constructor(
    private readonly selected: SelectedFlowRepository,
    private readonly flows: FlowRepository,
    private readonly definitions: EventRuleRepository,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID,
  ) {}
  getSelected(): SelectedFlow[] {
    const selectedIds = this.selected.listIds()
    const flowsById = new Map(this.flows.findManyByIds(selectedIds).map((flow) => [flow.id, flow]))
    const definitionIds = [...new Set([...flowsById.values()].flatMap((flow) => flow.events.map((event) => event.eventDefinitionId)))]
    const definitionsById = new Map(this.definitions.findManyByIds(definitionIds).map((definition) => [definition.id, definition]))
    return selectedIds.map((id, position) => {
      const flow = flowsById.get(id)
      if (!flow) throw new AppError('FLOW_NOT_FOUND', `Selected flow '${id}' was not found.`, 500)
      return {
        flowId: flow.id, name: flow.name, position,
        events: flow.events.map((event) => {
          const definition = definitionsById.get(event.eventDefinitionId)
          if (!definition) throw new AppError('EVENT_DEFINITION_NOT_FOUND', `Definition '${event.eventDefinitionId}' was not found.`, 500)
          return { flowEventId: event.id, eventDefinitionId: definition.id, eventName: definition.eventValue, eventDefinitionName: definition.name, position: event.position, rules: definition.rules }
        }),
      }
    })
  }
  replace(flowIds: string[]): SelectedFlow[] {
    if (new Set(flowIds).size !== flowIds.length) throw new AppError('DUPLICATE_SELECTED_FLOW', 'A flow can only be selected once.', 400)
    for (const id of flowIds) if (!this.flows.findById(id)) throw new AppError('FLOW_NOT_FOUND', `Flow '${id}' was not found.`, 400)
    this.selected.replace(flowIds, this.now(), this.id)
    return this.getSelected()
  }
}
