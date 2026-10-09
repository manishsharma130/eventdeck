import { StorageService } from '../modules/storage/storage.service.js'
import type { SqliteDatabase } from '../database/sqlite.database.js'
import type { AppLogger } from '../logging/logger.js'
import { FlowService } from '../modules/build-flow/application/flow.service.js'
import { SqliteFlowRepository } from '../modules/build-flow/infrastructure/sqlite-flow.repository.js'
import { EventRuleService } from '../modules/event-rules/application/event-rule.service.js'
import { RuntimeEventRuleIndex } from '../modules/event-rules/application/runtime-event-rule-index.js'
import { SqliteEventRuleRepository } from '../modules/event-rules/infrastructure/sqlite-event-rule.repository.js'
import { FlowExecutionService } from '../modules/flow-execution/application/flow-execution.service.js'
import { FlowSelectionService } from '../modules/flow-execution/application/flow-selection.service.js'
import { SqliteSelectedFlowRepository } from '../modules/flow-execution/infrastructure/sqlite-selected-flow.repository.js'
import type { AdbClient } from '../modules/live-stream/application/adb-client.js'
import { LiveEventBus } from '../modules/live-stream/application/live-event-bus.js'
import { LiveStreamService } from '../modules/live-stream/application/live-stream.service.js'
import { SqliteRecordingRepository } from '../modules/live-stream/infrastructure/sqlite-recording.repository.js'
import type { FastifyWebSocketGateway } from '../websocket/websocket.gateway.js'
import type { AppDependencies } from './server.types.js'

export function createDependencies(
  database: SqliteDatabase,
  logger: AppLogger,
  websocketGateway: FastifyWebSocketGateway,
  adbClient: AdbClient,
  version = '1.0.0',
): AppDependencies {
  const eventRuleRepository = new SqliteEventRuleRepository(database)
  const eventRuleIndex = new RuntimeEventRuleIndex()
  const eventRuleService = new EventRuleService(eventRuleRepository, eventRuleIndex)
  const flowRepository = new SqliteFlowRepository(database)
  const flowService = new FlowService(flowRepository, eventRuleRepository)
  const selectedFlowRepository = new SqliteSelectedFlowRepository(database)
  const flowSelectionService = new FlowSelectionService(selectedFlowRepository, flowRepository, eventRuleRepository)
  const liveEventBus = new LiveEventBus()
  const liveStreamService = new LiveStreamService(adbClient, new SqliteRecordingRepository(database), websocketGateway, liveEventBus, logger)
  const flowExecutionService = new FlowExecutionService(flowSelectionService, websocketGateway, liveEventBus)
  const storageService = new StorageService(database, eventRuleIndex, flowExecutionService, liveStreamService, websocketGateway)
  return {
    storageService, database, logger, websocketGateway, version, eventRuleService, eventRuleIndex, flowService,
    flowSelectionService, flowExecutionService, liveStreamService,
  }
}
