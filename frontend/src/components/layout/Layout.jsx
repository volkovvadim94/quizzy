import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Trophy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { getInitDataRaw, getTelegramStartParam, getTelegramWebApp } from '../../utils/telegram'
import { init, isTMA, viewport } from '../../utils/tma'
import { applyStoredTokenOverrides } from '../../theme/tokens'
import { authAPI } from '../../utils/api'
import {
  STORAGE_KEYS,
  getActiveGame,
  clearActiveGame,
  getClientSessionId,
  isSessionSuspended,
  setActiveGame,
  clearLastRoomHint,
  setLastRoomHint,
  setSessionSuspended,
  clearSessionSuspended,
} from '../../utils/storage'
import { gameAPI } from '../../utils/api'

export default function Layout({ children }) {
  const { user, logout, loading } = useAuth()
  const { socket, on, off, emit } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const handledStartParamRef = useRef(false)

  const tgWebApp = getTelegramWebApp()
  const isWebApp = Boolean(tgWebApp?.initData)
  const handledQrLoginRef = useRef(false)

  const resolveStartRoomCode = () => {
    const startParam = getTelegramStartParam()
    const roomCode = (startParam || '').trim()
    return /^[A-Za-z0-9]{6}$/.test(roomCode) ? roomCode : ''
  }

  useEffect(() => {
    const theme = 'quizzyDark'
    document.documentElement.setAttribute('data-theme', theme)
    applyStoredTokenOverrides(theme)
  }, [])

  // Telegram: always request full-viewport + fullscreen when available.
  useEffect(() => {
    async function initTg() {
      try {
        if (await isTMA()) {
          init()

          if (viewport.mount.isAvailable()) {
            await viewport.mount()
            viewport.expand()
          }

          if (viewport.requestFullscreen.isAvailable()) {
            await viewport.requestFullscreen()
          }
        }
      } catch (e) {
        // Never crash the app because of Telegram client quirks
        console.warn('Telegram init failed:', e)
      }
    }

    initTg()
  }, [])

  // Telegram deep-link support (t.me/... ?startapp=ROOMCODE).
  useEffect(() => {
    if (handledStartParamRef.current) return
    const roomCode = resolveStartRoomCode()
    if (!roomCode) return

    handledStartParamRef.current = true

    if (
      location.pathname.startsWith('/room/') ||
      location.pathname.startsWith('/game/') ||
      location.pathname.startsWith('/spectate/') ||
      location.pathname.startsWith('/profile') ||
      location.pathname.startsWith('/themelab') ||
      location.pathname.startsWith('/session-switched') ||
      /^\/[A-Za-z0-9]{6}$/.test(location.pathname)
    ) {
      return
    }

    setLastRoomHint(roomCode)
    navigate(`/room/${roomCode}`, { replace: true })
  }, [location.pathname, navigate])

  // Telegram QR login confirmation (startapp=login_<token>).
  useEffect(() => {
    if (!isWebApp) return
    if (handledQrLoginRef.current) return
    const startParam = String(getTelegramStartParam() || '').trim()
    if (!startParam.startsWith('login_')) return
    const qrToken = startParam.slice('login_'.length).trim()
    if (!qrToken) return

    handledQrLoginRef.current = true

    const initDataRaw = getInitDataRaw()
    if (!initDataRaw) return

    ;(async () => {
      try {
        await authAPI.telegramQrConfirm({ qrToken, initDataRaw })
      } catch (e) {
        console.warn('Telegram QR confirm failed:', e?.userMessage || e?.message || e)
      }
    })()
  }, [isWebApp])

  // Auto-restore active game only when authenticated
  useEffect(() => {
    if (loading) return

    const active = getActiveGame()

    if (!user) {
      clearActiveGame()
      return
    }

      const checkAndRedirect = async () => {
        if (!active) {
          const startRoom = resolveStartRoomCode()
          if (startRoom) {
            setLastRoomHint(startRoom)
            const isSpectate = location.pathname.startsWith('/spectate/')
            const isOnProfile = location.pathname.startsWith('/profile')
            const isOnThemeLab = location.pathname.startsWith('/themelab')
            if (!isSpectate && !isOnProfile && !isOnThemeLab && !location.pathname.startsWith('/room/') && !location.pathname.startsWith('/game/')) {
              navigate(`/room/${startRoom}`, { replace: true })
              return
            }
          }

          const directMatch = location.pathname.match(/^\/([A-Za-z0-9]{6})$/)
          if (directMatch) navigate(`/room/${directMatch[1]}`, { replace: true })
          return
        }

      const { id: activeGame, phase: activePhase } = active
      const isOnRoom = location.pathname.startsWith(`/room/${activeGame}`)
      const isOnGame = location.pathname.startsWith('/game/')
      const isDirectRoom = location.pathname === `/${activeGame}`
      const isSpectate = location.pathname.startsWith('/spectate/')
      const isOnProfile = location.pathname.startsWith('/profile')
      const isOnThemeLab = location.pathname.startsWith('/themelab')

      // Проверяем статус комнаты: если её нет или finished — очищаем локальное состояние
      try {
        const res = await gameAPI.get(activeGame)
        const status = res?.data?.status
        if (status === 'finished') {
          clearActiveGame()
          clearLastRoomHint()
          return
        }
      } catch (e) {
        clearActiveGame()
        clearLastRoomHint()
        return
      }

      if (!isOnRoom && !isOnGame && !isDirectRoom && !isSpectate && !isOnProfile && !isOnThemeLab) {
        const target = activePhase === 'active' ? `/game/${activeGame}` : `/room/${activeGame}`
        navigate(target, { replace: true })
      }
    }

    checkAndRedirect()
  }, [user, loading, location.pathname, navigate])

  // Global session takeover guard (works on any screen).
  useEffect(() => {
    const matchRoomIdFromPath = () => {
      const m = location.pathname.match(/^\/(?:room|game)\/([A-Za-z0-9]{6})/)
      return m?.[1] || ''
    }

    const handleTakenOver = ({ gameId } = {}) => {
      const gid = gameId || matchRoomIdFromPath() || getActiveGame()?.id || ''
      if (gid) setLastRoomHint(gid)
      clearActiveGame()
      setSessionSuspended(true)
      try {
        socket?.disconnect?.()
      } catch {
        // ignore
      }
      navigate(`/session-switched${gid ? `?gameId=${encodeURIComponent(gid)}` : ''}`, { replace: true })
    }

    const handleDisconnect = (reason) => {
      // Server forced disconnect (e.g. takeover). Avoid hijacking normal network drops.
      if (reason !== 'io server disconnect') return
      if (location.pathname.startsWith('/session-switched')) return
      const gid = matchRoomIdFromPath() || getActiveGame()?.id || ''
      if (gid) setLastRoomHint(gid)
      clearActiveGame()
      setSessionSuspended(true)
      navigate(`/session-switched${gid ? `?gameId=${encodeURIComponent(gid)}` : ''}`, { replace: true })
    }

    on('SESSION_TAKEN_OVER', handleTakenOver)
    on('disconnect', handleDisconnect)

    return () => {
      off('SESSION_TAKEN_OVER', handleTakenOver)
      off('disconnect', handleDisconnect)
    }
  }, [on, off, navigate, location.pathname, socket])

  // Register current device/session with backend so it can enforce takeover by telegramId.
  useEffect(() => {
    if (!user) return
    // Spectate/TV mode should not authenticate over sockets, otherwise opening it in another tab/device
    // can accidentally take over the active player session.
    if (location.pathname.startsWith('/spectate/')) return
    if (location.pathname.startsWith('/session-switched') && isSessionSuspended()) return
    const token = localStorage.getItem(STORAGE_KEYS.token)
    if (!token) return
    const clientSessionId = getClientSessionId()
    if (!clientSessionId) return

    let lastSocketId = null
    let lastActiveGameId = null

    const send = () => {
      if (!socket?.connected) return
      const sid = socket.id || null
      if (sid && lastSocketId === sid) return
      lastSocketId = sid
      emit('AUTH', { token, clientSessionId })
    }

    const reset = () => {
      lastSocketId = null
    }

    const handleAuthOk = () => {
      clearSessionSuspended()
    }

    const handleActiveGame = ({ gameId, status } = {}) => {
      const gid = (gameId || '').trim()
      if (!gid) return
      if (lastActiveGameId === gid) return
      lastActiveGameId = gid

      // Don't hijack intentional room/game/spectate/profile screens.
      if (
        location.pathname.startsWith('/room/') ||
        location.pathname.startsWith('/game/') ||
        location.pathname.startsWith('/spectate/') ||
        location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/themelab') ||
        location.pathname.startsWith('/session-switched') ||
        /^\/[A-Za-z0-9]{6}$/.test(location.pathname)
      ) {
        return
      }

      const phase = status === 'active' ? 'active' : 'room'
      setActiveGame(gid, phase)
      navigate(phase === 'active' ? `/game/${gid}` : `/room/${gid}`, { replace: true })
    }

    on('AUTH_OK', handleAuthOk)
    on('ACTIVE_GAME', handleActiveGame)
    send()
    on('connect', send)
    on('disconnect', reset)

    return () => {
      off('AUTH_OK', handleAuthOk)
      off('ACTIVE_GAME', handleActiveGame)
      off('connect', send)
      off('disconnect', reset)
    }
  }, [user, socket, emit, on, off, navigate, location.pathname])

  const score = user?.totalScore ?? 0
  const displayName =
    user?.username || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Игрок'

  // TV/Spectate mode must be full-bleed without the app header.
  if (location.pathname.startsWith('/spectate/')) {
    return (
      <div className="page-shell text-base-content transition-colors flex flex-col h-screen overflow-hidden">
        <main className="scroll-mask flex-1 min-h-0 w-full safe-bottom">{children}</main>
      </div>
    )
  }

  return (
    <div className="page-shell text-base-content transition-colors flex flex-col h-screen overflow-hidden">
      {isWebApp ? (
        <div
          className="navbar sticky top-0 z-30 px-4 justify-center items-start shadow-none border-b pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-2 min-h-[110px]"
          style={{ backgroundColor: 'var(--quizzy-tg-header-bg)', borderBottomColor: 'var(--quizzy-header-border)' }}
        >
          <button onClick={() => navigate('/')} className="flex items-center justify-center">
            <img src="/logo.png" alt="Quizzy" className="h-20 w-auto" />
          </button>
        </div>
      ) : (
        <div className="navbar navbar-surface shadow-2xl sticky top-0 z-30 px-4">
        <div className="navbar-start gap-3">
          <button className="text-[2.4rem] font-black tracking-tight text-white" onClick={() => navigate('/')}>
            QUIZZY
          </button>
        </div>

        <div className="navbar-center" />

        <div className="navbar-end gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-sm font-semibold"
                style={{ backgroundColor: 'var(--quizzy-pill-bg)' }}
                title="Глобальный рейтинг"
              >
                <Trophy size={16} style={{ color: 'var(--quizzy-accent)' }} />
                <span>{score}</span>
              </div>

              <div className="avatar select-none" title={displayName} style={{ cursor: 'default' }}>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-primary text-primary-content flex items-center justify-center">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={displayName} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-sm font-bold">{displayName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              </div>

              {isWebApp ? null : (
                <button
                  onClick={logout}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--quizzy-danger)', color: 'var(--quizzy-btn-fg)' }}
                  title="Выйти"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          ) : null}
        </div>
        </div>
      )}

      <main className="container mx-auto px-4а1b2d4f py-4 flex-1 min-h-0 w-full flex flex-col gap-4 overflow-hidden safe-bottom">
        {children}
      </main>
    </div>
  )
}
