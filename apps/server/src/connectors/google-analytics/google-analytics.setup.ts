import type { ConnectorContext } from '../connector.types.js'
export async function setupGoogleAnalytics(context: ConnectorContext): Promise<void> {
  for (const tag of ['FA', 'FA-SVC']) {
    await context.runAdbCommand(['-s', context.deviceId, 'shell', 'setprop', `log.tag.${tag}`, 'VERBOSE'])
  }
}
