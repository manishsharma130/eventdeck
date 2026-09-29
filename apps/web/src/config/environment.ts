const websocketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

export const environment = {
  apiUrl: import.meta.env.VITE_EVENTDECK_API_URL ?? '',
  websocketUrl: import.meta.env.VITE_EVENTDECK_WEBSOCKET_URL ?? `${websocketProtocol}//${window.location.host}/ws`,
} as const
