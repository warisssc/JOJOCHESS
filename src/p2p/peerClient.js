import Peer from 'peerjs'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode() {
  let code = 'JOJO-'
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
  return code
}

/**
 * Host a P2P room on PeerJS's free public signaling server.
 * Returns { send, setHandlers, destroy }.
 */
export function hostPeerRoom(initialHandlers = {}) {
  const roomId = generateRoomCode()
  const peer = new Peer(roomId, { debug: 1 })
  let activeConn = null
  let handlers = { ...initialHandlers }

  peer.on('open', (id) => handlers.onOpen?.(id))

  peer.on('connection', (conn) => {
    activeConn = conn
    conn.on('open', () => handlers.onConnect?.(conn))
    conn.on('data', (data) => handlers.onData?.(data))
    conn.on('close', () => handlers.onClose?.())
    conn.on('error', (err) => handlers.onError?.(err))
  })

  peer.on('error', (err) => handlers.onError?.(err))

  return {
    roomId,
    setHandlers(next) {
      handlers = { ...handlers, ...next }
    },
    send(payload) {
      if (activeConn && activeConn.open) activeConn.send(payload)
    },
    destroy() {
      activeConn?.close()
      peer.destroy()
    },
  }
}

/**
 * Join an existing P2P room by room code.
 * Returns { send, setHandlers, destroy }.
 */
export function joinPeerRoom(roomCode, initialHandlers = {}) {
  const targetId = roomCode.trim().toUpperCase()
  const peer = new Peer({ debug: 1 })
  let activeConn = null
  let handlers = { ...initialHandlers }

  peer.on('open', () => {
    const conn = peer.connect(targetId, { reliable: true })
    activeConn = conn
    conn.on('open', () => handlers.onConnect?.(conn))
    conn.on('data', (data) => handlers.onData?.(data))
    conn.on('close', () => handlers.onClose?.())
    conn.on('error', (err) => handlers.onError?.(err))
  })

  peer.on('error', (err) => handlers.onError?.(err))

  return {
    roomId: targetId,
    setHandlers(next) {
      handlers = { ...handlers, ...next }
    },
    send(payload) {
      if (activeConn && activeConn.open) activeConn.send(payload)
    },
    destroy() {
      activeConn?.close()
      peer.destroy()
    },
  }
}
