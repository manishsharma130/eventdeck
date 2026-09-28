import { compileDefinition, matchesDefinition, type CompiledEventDefinition } from '../domain/event-rule.matcher.js'
import type { EventDefinition, LiveEvent } from '../domain/event-rule.types.js'

export class RuntimeEventRuleIndex {
  private readonly byEventValue = new Map<string, CompiledEventDefinition[]>()

  rebuild(definitions: EventDefinition[]): void {
    this.byEventValue.clear()
    for (const definition of definitions) this.upsert(definition)
  }

  upsert(definition: EventDefinition): void {
    this.remove(definition.id)
    const compiled = compileDefinition(definition)
    const candidates = this.byEventValue.get(compiled.eventValue) ?? []
    candidates.push(compiled)
    this.byEventValue.set(compiled.eventValue, candidates)
  }

  remove(id: string): void {
    for (const [eventValue, definitions] of this.byEventValue) {
      const remaining = definitions.filter((definition) => definition.id !== id)
      if (remaining.length === 0) this.byEventValue.delete(eventValue)
      else this.byEventValue.set(eventValue, remaining)
    }
  }

  match(event: LiveEvent): CompiledEventDefinition[] {
    return (this.byEventValue.get(event.eventName) ?? []).filter((definition) => matchesDefinition(event, definition))
  }
}
