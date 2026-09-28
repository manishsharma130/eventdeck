import { describe, expect, it } from 'vitest'
import { compileDefinition, matchesDefinition } from '../../src/modules/event-rules/domain/event-rule.matcher.js'
import { createRuleSignature } from '../../src/modules/event-rules/domain/event-rule-signature.js'

describe('event rule domain', () => {
  it('generates an order-independent signature', () => {
    const first = createRuleSignature({ name: 'One', eventValue: 'app_open', rules: [
      { paramKey: 'screen', matchType: 'exact', expectedValue: 'home' },
      { paramKey: 'hook', matchType: 'exists' },
    ] })
    const second = createRuleSignature({ name: 'Two', eventValue: 'app_open', rules: [
      { paramKey: 'hook', matchType: 'exists' },
      { paramKey: 'screen', matchType: 'exact', expectedValue: 'home' },
    ] })
    expect(first).toBe(second)
  })

  it('matches exact, contains, exists, and precompiled regex rules', () => {
    const definition = compileDefinition({
      id: 'definition', name: 'Definition', eventValue: 'purchase', createdAt: 1, updatedAt: 1,
      rules: [
        { id: '1', paramKey: 'plan', matchType: 'exact', expectedValue: 'premium' },
        { id: '2', paramKey: 'screen', matchType: 'contains', expectedValue: 'checkout' },
        { id: '3', paramKey: 'user_id', matchType: 'exists' },
        { id: '4', paramKey: 'product_id', matchType: 'regex', expectedValue: '^P[0-9]+$' },
      ],
    })
    expect(matchesDefinition({ eventName: 'purchase', eventParams: { plan: 'premium', screen: 'fast_checkout', user_id: 0, product_id: 'P100' } }, definition)).toBe(true)
    expect(matchesDefinition({ eventName: 'purchase', eventParams: { plan: 'free', screen: 'fast_checkout', user_id: 0, product_id: 'P100' } }, definition)).toBe(false)
  })
})
