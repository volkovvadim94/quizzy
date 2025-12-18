import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import io from 'socket.io-client'

/**
 * Socket.IO connection helper.
 *
 * Real-world deployment gotchas:
 * - Reverse proxies often DON'T support WebSocket upgrade unless configured (=> websocket handshake 400).
 * - Some proxies mount backend under /api, others expose /socket.io directly.
 *
 * Strategy:
 * 1) Try a set of (baseUrl, path) candidates.
 * 2) Start with HTTP long-polling, then allow upgrade to websocket (if available).
 * 3) Queue emits while disconnected and flush after connect/reconnect.
 */

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used within SocketProvider')
  return context
}

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)))

const buildCandidates = () => {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL
  const envApiUrl = import.meta.env.VITE_API_URL
  const apiOrigin = envApiUrl ? envApiUrl.replace(/\/api\/?$/, '') : null
  const origin = typeof window !== 'undefined' ? window.location.origin : null

  // Try explicit socket url first, then api origin, then current origin
  const urls = uniq([envSocketUrl, apiOrigin, origin])

  // Different deployments might proxy socket.io under these paths:
  const paths = ['/socket.io', '/api/socket.io']

  const candidates = []
  for (const url of urls) {
    for (const path of paths) candidates.push({ url, path })
  }
  return candidates
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  const socketRef = useRef(null)
  const isConnectedRef = useRef(false)
  const emitQueueRef = useRef([])
  const attemptIndexRef = useRef(0)

  const candidates = useMemo(() => buildCandidates(), [])

  const cleanupSocket = (s) => {
    try {
      s?.removeAllListeners?.()
      s?.close?.()
    } catch {
      // ignore
    }
  }

  const flushQueue = () => {
    const s = socketRef.current
    if (!s || !isConnectedRef.current) return
    const q = emitQueueRef.current
    emitQueueRef.current = []
    q.forEach(({ event, data }) => {
      try {
        s.emit(event, data)
      } catch {
        // ignore
      }
    })
  }

  const attachBaseHandlers = (s, cfg) => {
    s.on('connect', () => {
      console.log('Socket.IO connected:', s.id, cfg)
      setIsConnected(true)
      isConnectedRef.current = true
      flushQueue()
    })

    s.on('disconnect', (reason) => {
      console.warn('Socket.IO disconnected:', reason, cfg)
      setIsConnected(false)
      isConnectedRef.current = false
    })

    s.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', cfg, err?.message || err)
    })
  }

  const tryConnectNext = () => {
    cleanupSocket(socketRef.current)
    socketRef.current = null
    setSocket(null)
    setIsConnected(false)
    isConnectedRef.current = false

    if (attemptIndexRef.current >= candidates.length) {
      console.error('Socket.IO: all connection attempts failed')
      return
    }

    const cfg = candidates[attemptIndexRef.current]
    attemptIndexRef.current += 1

    console.log('Initializing Socket.IO connection attempt...', cfg)

    const s = io(cfg.url, {
      path: cfg.path,

      // ✅ IMPORTANT: start with polling so it works even if WS upgrade is blocked by proxy.
      transports: ['polling', 'websocket'],
      upgrade: true,

      withCredentials: true,

      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      timeout: 15000,
    })

    socketRef.current = s
    setSocket(s)

    attachBaseHandlers(s, cfg)

    // If we can't connect quickly, try the next candidate.
    // Note: connect_error may fire multiple times. We only advance once per attempt.
    let advanced = false
    const advance = () => {
      if (advanced) return
      advanced = true
      cleanupSocket(s)
      tryConnectNext()
    }

    const onConnectError = () => advance()

    // After a short window without a successful connect, advance.
    const timer = setTimeout(() => {
      if (!isConnectedRef.current) advance()
    }, 3500)

    s.once('connect', () => {
      clearTimeout(timer)
      s.off('connect_error', onConnectError)
    })
    s.on('connect_error', onConnectError)
  }

  useEffect(() => {
    attemptIndexRef.current = 0
    tryConnectNext()

    return () => {
      cleanupSocket(socketRef.current)
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = useCallback((event, data) => {
    const s = socketRef.current
    if (!s || !isConnectedRef.current) {
      // Queue while disconnected
      emitQueueRef.current.push({ event, data })
      console.warn('Socket not connected, queued emit:', event)
      return
    }
    s.emit(event, data)
  }, [])

  const on = useCallback((event, handler) => {
    const s = socketRef.current
    if (!s) return
    s.on(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    const s = socketRef.current
    if (!s) return
    if (handler) s.off(event, handler)
    else s.off(event)
  }, [])

  const value = useMemo(() => ({ socket, isConnected, emit, on, off }), [socket, isConnected, emit, on, off])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
