const localServerUrl = 'http://127.0.0.1:4732'
const localWebsocketUrl = 'ws://127.0.0.1:4732/ws'
const developmentWebsocketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

export const environment = {
  apiUrl: import.meta.env.VITE_EVENTDECK_API_URL ?? (import.meta.env.PROD ? localServerUrl : ''),
  websocketUrl: import.meta.env.VITE_EVENTDECK_WEBSOCKET_URL
    ?? (import.meta.env.PROD ? localWebsocketUrl : `${developmentWebsocketProtocol}//${window.location.host}/ws`),
} as const
