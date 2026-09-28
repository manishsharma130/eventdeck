import type { EventDefinition, EventRuleCondition, LiveEvent } from './event-rule.types.js'

export type CompiledRule = EventRuleCondition & { regex?: RegExp }
export type CompiledEventDefinition = Omit<EventDefinition, 'rules'> & { rules: CompiledRule[] }

export function compileDefinition(definition: EventDefinition): CompiledEventDefinition {
  return {
    ...definition,
    rules: definition.rules.map((rule) => ({
      ...rule,
      ...(rule.matchType === 'regex' ? { regex: new RegExp(rule.expectedValue ?? '') } : {}),
    })),
  }
}

export function matchesDefinition(event: LiveEvent, definition: CompiledEventDefinition): boolean {
  if (event.eventName !== definition.eventValue) return false
  return definition.rules.every((rule) => {
    const exists = Object.prototype.hasOwnProperty.call(event.eventParams, rule.paramKey)
    if (rule.matchType === 'exists') return exists
    if (!exists) return false
    const actual = String(event.eventParams[rule.paramKey])
    if (rule.matchType === 'exact') return actual === rule.expectedValue
    if (rule.matchType === 'contains') return actual.includes(rule.expectedValue ?? '')
    return rule.regex?.test(actual) ?? false
  })
}
