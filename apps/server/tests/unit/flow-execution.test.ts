import { describe, expect, it } from 'vitest'
import type { FlowSelectionService } from '../../src/modules/flow-execution/application/flow-selection.service.js'
import { FlowExecutionService } from '../../src/modules/flow-execution/application/flow-execution.service.js'
import { LiveEventBus } from '../../src/modules/live-stream/application/live-event-bus.js'
import type { WebSocketGateway } from '../../src/websocket/websocket.types.js'

describe('flow execution failures', () => {
  it('publishes definition context and finalizes an unrecoverable error', () => {
    const messages: Array<{ type: string; payload: unknown }> = []
    const websocket: WebSocketGateway = {
      broadcast: (type, payload) => { messages.push({ type, payload }) },
      sendToClient: () => undefined,
      close: () => undefined,
    }
    const selection = { getSelected: () => [{
      flowId: 'flow-1', name: 'Flow', position: 0,
      events: [{ flowEventId: 'flow-event-1', eventDefinitionId: 'definition-1', eventName: 'open', eventDefinitionName: 'Open', position: 0, rules: [{ id: 'rule-1', paramKey: 'screen', matchType: 'exact' as const, expectedValue: 'home' }] }],
    }] } as unknown as FlowSelectionService
    const eventBus = new LiveEventBus()
    const service = new FlowExecutionService(selection, websocket, eventBus)
    service.start()

    const eventParams = new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error('Unable to read event parameter') } })
    service.handleEvent({ eventName: 'open', eventParams })

    expect(service.getState().active).toBe(false)
    expect(service.getLastCompletion()).toMatchObject({ reason: 'EXECUTION_ERROR', flows: [{ status: 'FAILED', failedEvents: 1 }] })
    expect(messages.find((message) => message.type === 'flow_execution.validation_error')?.payload).toMatchObject({
      message: 'Unable to read event parameter', eventDefinitionId: 'definition-1', eventName: 'open',
    })
    expect(messages.at(-1)).toMatchObject({ type: 'flow_execution.validation_completed', payload: { reason: 'EXECUTION_ERROR' } })
  })

  it('resets completed event statuses to pending while idle', () => {
    const messages: Array<{ type: string; payload: unknown }> = []
    const websocket: WebSocketGateway = {
      broadcast: (type, payload) => { messages.push({ type, payload }) },
      sendToClient: () => undefined,
      close: () => undefined,
    }
    const selection = { getSelected: () => [{
      flowId: 'flow-1', name: 'Flow', position: 0,
      events: [{ flowEventId: 'flow-event-1', eventDefinitionId: 'definition-1', eventName: 'open', eventDefinitionName: 'Open', position: 0, rules: [] }],
    }] } as unknown as FlowSelectionService
    const service = new FlowExecutionService(selection, websocket, new LiveEventBus())
    service.start()
    expect(() => service.reset()).toThrow('Stop validation before resetting its status.')
    service.handleEvent({ eventName: 'open', eventParams: {} })
    service.stop()

    const reset = service.reset()

    expect(reset).toMatchObject({ status: 'reset', flows: [{ events: [{ status: 'PENDING' }] }] })
    expect(service.getState()).toMatchObject({ active: false, flows: [{ events: [{ status: 'PENDING' }] }] })
    expect(service.getLastCompletion()).toBeNull()
    expect(messages.at(-1)).toMatchObject({ type: 'flow_execution.reset', payload: { status: 'reset' } })
  })
})
