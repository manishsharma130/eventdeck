import { WebSocketServer } from 'ws'
import { HOST, PORT } from './websocket.js'

export interface EventDeckServer {
  start(): Promise<void>
  close(): Promise<void>
}

export function createServer(): EventDeckServer {
  let server: WebSocketServer | undefined

  return {
    start: () =>
      new Promise((resolve, reject) => {
        server = new WebSocketServer({ host: HOST, port: PORT })
        server.once('listening', resolve)
        server.once('error', reject)
        server.on('connection', (socket) => {
          socket.on('message', (message, isBinary) => socket.send(message, { binary: isBinary }))
        })
      }),
    close: () =>
      new Promise((resolve, reject) => {
        if (!server) return resolve()
        for (const client of server.clients) client.close()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
