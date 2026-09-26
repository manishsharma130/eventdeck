export const environment = {
  websocketUrl: import.meta.env.VITE_EVENTDECK_WEBSOCKET_URL ?? 'ws://127.0.0.1:4732',
} as const
