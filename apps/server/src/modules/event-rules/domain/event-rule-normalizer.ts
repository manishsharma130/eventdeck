import type { EventDefinitionInput, MatchType } from './event-rule.types.js'

export type NormalizedRule = { paramKey: string; matchType: MatchType; expectedValue: string }

export function normalizeDefinition(input: EventDefinitionInput): {
  name: string
  eventValue: string
  rules: NormalizedRule[]
} {
  const eventValue = input.eventValue.trim()
  return {
    name: input.name.trim() || eventValue,
    eventValue,
    rules: input.rules.map((rule) => ({
      paramKey: rule.paramKey.trim(),
      matchType: rule.matchType,
      expectedValue: rule.matchType === 'exists' ? '' : (rule.expectedValue ?? '').trim(),
    })).sort((left, right) => canonicalRule(left).localeCompare(canonicalRule(right))),
  }
}

export function canonicalRule(rule: NormalizedRule): string {
  return `${rule.paramKey}|${rule.matchType}|${rule.expectedValue}`
}
