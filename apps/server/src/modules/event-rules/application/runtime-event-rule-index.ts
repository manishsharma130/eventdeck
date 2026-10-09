import { compileDefinition, matchesDefinition, type CompiledEventDefinition } from '../domain/event-rule.matcher.js'
import type { EventDefinition, LiveEvent } from '../domain/event-rule.types.js'

export class RuntimeEventRuleIndex {
  private readonly byEventValue = new Map<string, CompiledEventDefinition[]>()
  private readonly eventValueById = new Map<string, string>()

  rebuild(definitions: EventDefinition[]): void {
    this.byEventValue.clear()
    this.eventValueById.clear()
    for (const definition of definitions) this.upsert(definition)
  }

  upsert(definition: EventDefinition): void {
    this.remove(definition.id)
    const compiled = compileDefinition(definition)
    const candidates = this.byEventValue.get(compiled.eventValue) ?? []
    candidates.push(compiled)
    this.byEventValue.set(compiled.eventValue, candidates)
    this.eventValueById.set(compiled.id, compiled.eventValue)
  }

  remove(id: string): void {
    const eventValue = this.eventValueById.get(id)
    if (!eventValue) return
    const remaining = (this.byEventValue.get(eventValue) ?? []).filter((definition) => definition.id !== id)
    if (remaining.length === 0) this.byEventValue.delete(eventValue)
    else this.byEventValue.set(eventValue, remaining)
    this.eventValueById.delete(id)
  }

  match(event: LiveEvent): CompiledEventDefinition[] {
    return (this.byEventValue.get(event.eventName) ?? []).filter((definition) => matchesDefinition(event, definition))
  }
}
