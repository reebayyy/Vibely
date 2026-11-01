import { io, type Socket } from 'socket.io-client'

import { SOCKET_URL } from './config'
import { getToken } from './api'

let socket: Socket | null = null

export function connectSocket(): Socket {
  if (!socket) {
    socket = SOCKET_URL ? io(SOCKET_URL, { autoConnect: false }) : io({ autoConnect: false })
  }

  // The token can change when a different account signs in.
  socket.auth = { token: getToken() ?? '' }

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
}
