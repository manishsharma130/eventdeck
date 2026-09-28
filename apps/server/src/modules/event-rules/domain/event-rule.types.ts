export const matchTypes = ['exact', 'contains', 'exists', 'regex'] as const
export type MatchType = (typeof matchTypes)[number]

export type EventRuleCondition = {
  id: string
  paramKey: string
  matchType: MatchType
  expectedValue?: string
}

export type EventDefinition = {
  id: string
  name: string
  eventValue: string
  rules: EventRuleCondition[]
  createdAt: number
  updatedAt: number
}

export type EventDefinitionInput = {
  name: string
  eventValue: string
  rules: Array<Omit<EventRuleCondition, 'id'>>
}

export type LiveEvent = {
  eventName: string
  eventTag?: string
  eventParams: Record<string, unknown>
  [key: string]: unknown
}
