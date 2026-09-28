import type { LiveEvent } from '../../event-rules/domain/event-rule.types.js'

export class LiveEventBus {
  private readonly listeners = new Set<(event: LiveEvent) => void>()
  subscribe(listener: (event: LiveEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  publish(event: LiveEvent): void { for (const listener of this.listeners) listener(event) }
}
