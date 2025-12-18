import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import {
  STORAGE_KEYS,
  clearLastRoomHint,
  getClientSessionId,
  getLastRoomHint,
  setActiveGame,
  setLastRoomHint,
  clearSessionSuspended,
  isSessionSuspended,
  isSessionSuspendedRecent,
} from '../utils/storage'
import { gameAPI } from '../utils/api'
import CenteredCard from '../components/feedback/CenteredCard'

export default function SessionSwitched() {
  const location = useLocation()
  const navigate = useNavigate()
  const { socket, emit, on, off } = useSocket()
  const [pending, setPending] = useState(false)
  const timerRef = useRef(null)

  const rawGameId = useMemo(() => {
    const params = new URLSearchParams(location.search || '')
    return params.get('gameId') || getLastRoomHint() || ''
  }, [location.search])

  const [liveGameId, setLiveGameId] = useState('')

  // Validate cached/URL room id against backend memory (rooms can disappear after server restart).
  useEffect(() => {
    const candidate = (rawGameId || '').trim().toUpperCase()
    if (!candidate) {
      setLiveGameId('')
      return
    }

    let canceled = false

    ;(async () => {
      try {
        await gameAPI.get(candidate)
        if (canceled) return
        setLiveGameId(candidate)
      } catch {
        if (canceled) return
        setLiveGameId('')
        clearLastRoomHint()
        const params = new URLSearchParams(location.search || '')
        if (params.get('gameId')) {
          navigate('/session-switched', { replace: true })
        }
      }
    })()

    return () => {
      canceled = true
    }
  }, [rawGameId, location.search, navigate])

  const target = useMemo(() => {
    const gid = (liveGameId || '').trim()
    if (gid) return `/room/${gid}`
    return '/'
  }, [liveGameId])

  // If this screen is "stale" (e.g. app was previously left on it), auto-takeover on mount.
  // But if the user was just kicked (recent), require explicit tap to avoid ping-pong.
  useEffect(() => {
    if (!isSessionSuspended()) return
    if (isSessionSuspendedRecent(5000)) return

    const t = setTimeout(() => {
      try {
        takeOverHere()
      } catch {
        // ignore
      }
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveGameId, rawGameId])

  const takeOverHere = () => {
    if (pending) return
    setPending(true)
    clearSessionSuspended()

    const token = localStorage.getItem(STORAGE_KEYS.token)
    const clientSessionId = getClientSessionId()
    let resolved = false
    const known = (liveGameId || '').trim()

    const cleanup = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      off('AUTH_OK', handleOk)
      off('ACTIVE_GAME', handleActiveGame)
    }

    const finish = ({ nextGameId, status } = {}) => {
      if (resolved) return
      resolved = true
      setPending(false)
      clearLastRoomHint()

      const gid = (nextGameId || '').trim()
      if (gid) {
        setLastRoomHint(gid)
        const phase = status === 'active' ? 'active' : 'room'
        setActiveGame(gid, phase)
        navigate(phase === 'active' ? `/game/${gid}` : `/room/${gid}`, { replace: true })
        return
      }

      navigate(target, { replace: true })
    }

    const handleActiveGame = ({ gameId: activeId, status } = {}) => {
      cleanup()
      finish({ nextGameId: activeId, status })
    }

    const handleOk = () => {
      // If we already know the room from query/local hint, go there immediately.
      const known = (gameId || '').trim()
      if (known) {
        cleanup()
        finish({ nextGameId: known, status: 'waiting' })
        return
      }
      // Otherwise wait briefly for ACTIVE_GAME from backend (it includes the room id).
      // Fallback timer below will send us to Home if nothing arrives.
    }

    if (!token || !clientSessionId) return finish()

    on('ACTIVE_GAME', handleActiveGame)
    on('AUTH_OK', handleOk)
    emit('AUTH', { token, clientSessionId })

    try {
      if (socket && !socket.connected && typeof socket.connect === 'function') {
        socket.connect()
      }
    } catch {
      // ignore
    }

    // If we already know a *live* room id, navigate immediately.
    // Auth will complete in background and Room/Game will join via socket.
    if (known) {
      cleanup()
      finish({ nextGameId: known, status: 'waiting' })
      return
    }

    timerRef.current = setTimeout(() => {
      cleanup()
      finish()
    }, 2500)
  }

  return (
    <CenteredCard
      title="Сессия переключена"
      actions={
        <button className={`btn btn-primary ${pending ? 'btn-disabled' : ''}`} onClick={takeOverHere} disabled={pending}>
          {pending ? 'Подключаем...' : 'Подключиться здесь'}
        </button>
      }
    >
      <div className="opacity-80 text-sm">
        Этот аккаунт открыл Quizzy на другом устройстве. Чтобы не было конфликтов, текущее соединение отключено.
      </div>
      {liveGameId ? <div className="text-xs opacity-70">Комната: {liveGameId}</div> : null}
    </CenteredCard>
  )
}
