import type { AnalyticsConnector } from '../connector.types.js'
import { parseBranchEvent } from './branch.parser.js'
export const branchConnector: AnalyticsConnector = {
  id: 'branch', logcatFilters: ['BranchSDK:V'],
  matches: e => e.tag === 'BranchSDK' && e.level === 'V' && e.message.includes('setPost'),
  parse: parseBranchEvent,
}
