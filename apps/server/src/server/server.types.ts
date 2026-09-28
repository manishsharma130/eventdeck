import type { Database } from '../database/database.types.js'
import type { AppLogger } from '../logging/logger.js'
import type { FastifyWebSocketGateway } from '../websocket/websocket.gateway.js'
import type { FlowService } from '../modules/build-flow/application/flow.service.js'
import type { EventRuleService } from '../modules/event-rules/application/event-rule.service.js'
import type { RuntimeEventRuleIndex } from '../modules/event-rules/application/runtime-event-rule-index.js'
import type { FlowExecutionService } from '../modules/flow-execution/application/flow-execution.service.js'
import type { FlowSelectionService } from '../modules/flow-execution/application/flow-selection.service.js'
import type { LiveStreamService } from '../modules/live-stream/application/live-stream.service.js'

export type AppDependencies = {
  database: Database
  logger: AppLogger
  websocketGateway: FastifyWebSocketGateway
  eventRuleService: EventRuleService
  eventRuleIndex: RuntimeEventRuleIndex
  flowService: FlowService
  flowSelectionService: FlowSelectionService
  flowExecutionService: FlowExecutionService
  liveStreamService: LiveStreamService
  version: string
}
