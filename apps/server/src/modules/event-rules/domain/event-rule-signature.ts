import { createHash } from 'node:crypto'
import { canonicalRule, normalizeDefinition } from './event-rule-normalizer.js'
import type { EventDefinitionInput } from './event-rule.types.js'

export function createRuleSignature(input: EventDefinitionInput): string {
  const normalized = normalizeDefinition(input)
  const canonical = [normalized.eventValue, ...normalized.rules.map(canonicalRule)].join('|')
  return createHash('sha256').update(canonical).digest('hex')
}
