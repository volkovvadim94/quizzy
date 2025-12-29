import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { getInitDataRaw, getTelegramStartParam, getTelegramWebApp } from '../../utils/telegram'
import { init, isTMA, viewport } from '../../utils/tma'
import { applyStoredTokenOverrides } from '../../theme/tokens'
import { authAPI } from '../../utils/api'
import BottomNav from '../nav/BottomNav'
import { tgTopPadding } from '../../utils/safeArea'
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
  const { user, loading } = useAuth()
  const { socket, on, off, emit } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const handledStartParamRef = useRef(false)

  const tgWebApp = getTelegramWebApp()
  const isWebApp = Boolean(tgWebApp?.initData)
  const handledQrLoginRef = useRef(false)

  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.theme)
      if (stored === 'quizzyLight' || stored === 'quizzyDark') return stored
    } catch {
      // ignore
    }
    const current = document.documentElement.getAttribute('data-theme')
    return current === 'quizzyLight' ? 'quizzyLight' : 'quizzyDark'
  })

  const resolveStartRoomCode = () => {
    const startParam = getTelegramStartParam()
    const roomCode = (startParam || '').trim()
    return /^[A-Za-z0-9]{6}$/.test(roomCode) ? roomCode : ''
  }

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    applyStoredTokenOverrides(theme)
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme)
    } catch {
      // ignore
    }
  }, [theme])

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

          // Prevent accidental mini-app collapse by vertical swipe (when supported by client).
          try {
            tgWebApp?.disableVerticalSwipes?.()
          } catch (e) {
            console.warn('Telegram WebApp disableVerticalSwipes failed:', e)
          }

          // Disable swipe-back gesture when supported (Android).
          try {
            tgWebApp?.setSwipeBackEnabled?.(false)
          } catch (e) {
            console.warn('Telegram WebApp setSwipeBackEnabled failed:', e)
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

    const isProfile = location.pathname.startsWith('/profile')
    const isRating = location.pathname.startsWith('/rating')
    const isSettings = location.pathname.startsWith('/settings')
    if (isProfile || isRating || isSettings) return

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
            if (
              !isSpectate &&
              !isProfile &&
              !isRating &&
              !isSettings &&
              !location.pathname.startsWith('/room/') &&
              !location.pathname.startsWith('/game/')
            ) {
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
      const isOnProfile = isProfile
      const isOnRating = isRating
      const isOnSettings = isSettings

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

      if (!isOnRoom && !isOnGame && !isDirectRoom && !isSpectate && !isOnProfile && !isOnRating && !isOnSettings) {
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

    if (location.pathname.startsWith('/profile') || location.pathname.startsWith('/rating') || location.pathname.startsWith('/settings')) {
      return
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
        location.pathname.startsWith('/rating') ||
        location.pathname.startsWith('/settings') ||
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

  const pathname = location.pathname
  const showBottomNav =
    !!user &&
    (pathname === '/' ||
      pathname === '/home' ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/rating') ||
      pathname.startsWith('/settings'))

  const activeTab = pathname.startsWith('/profile')
    ? 'profile'
    : pathname.startsWith('/rating')
      ? 'rating'
      : pathname.startsWith('/settings')
        ? 'settings'
        : 'game'

  const toggleTheme = () => setTheme((t) => (t === 'quizzyDark' ? 'quizzyLight' : 'quizzyDark'))

  // TV/Spectate mode must be full-bleed without the app header.
  if (location.pathname.startsWith('/spectate/')) {
    return (
      <div className="page-shell text-base-content transition-colors flex flex-col h-screen overflow-hidden">
        <main className="scroll-mask flex-1 min-h-0 w-full safe-bottom px-4 py-4">{children}</main>
      </div>
    )
  }

  const hideAppHeader =
    showBottomNav ||
    pathname.startsWith('/new-game') ||
    pathname === '/join' ||
    pathname.startsWith('/room/') ||
    pathname.startsWith('/game/')

  const isHomeScreen = pathname === '/' || pathname === '/home'

  return (
    <div className="page-shell text-base-content transition-colors flex flex-col h-screen overflow-hidden">
      {hideAppHeader ? null : (
        <div
        className={`navbar sticky top-0 z-30 px-4 justify-center shadow-none ${
          isWebApp ? 'items-start pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-2 min-h-[110px]' : 'items-center py-4 min-h-[72px]'
        }`}
        style={{ backgroundColor: 'var(--quizzy-header-bg)' }}
      >
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-center select-none"
          aria-label={theme === 'quizzyDark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          title={theme === 'quizzyDark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          <img src="/logo.png" alt="Quizzy" className={isWebApp ? 'h-20 w-auto' : 'h-16 w-auto'} />
        </button>
        </div>
      )}

      <main
        className={`flex-1 min-h-0 w-full flex flex-col gap-4 ${
          showBottomNav
            ? `${isHomeScreen ? 'overflow-hidden' : 'scroll-mask overflow-y-auto'} safe-bottom-nav w-full max-w-[1200px] mx-auto px-4`
            : 'container mx-auto px-4 py-4 overflow-hidden safe-bottom'
        }`}
        style={
          showBottomNav
            ? { paddingTop: tgTopPadding(isWebApp, { defaultExtraPx: isHomeScreen ? 20 : 12 }) }
            : undefined
        }
      >
        {children}
      </main>

      {showBottomNav ? <BottomNav active={activeTab} onNavigate={(to) => navigate(to)} /> : null}
    </div>
  )
}
