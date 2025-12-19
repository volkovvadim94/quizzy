import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { gameAPI } from '../utils/api'
import { clearActiveGame, getClientSessionId, setActiveGame } from '../utils/storage'
import { getTelegramWebApp, isTelegramWebApp } from '../utils/telegram'
import { Copy, Play, Users, Share2, CheckCircle2, LogOut as Leave, Tv } from 'lucide-react'
import Snackbar from '../components/feedback/Snackbar'
import RoomNotFound from '../components/room/RoomNotFound'

const difficultyMeta = {
  easy: { label: 'ЛЕГКО', badge: 'badge-q2' },
  medium: { label: 'СРЕДНЕ', badge: 'badge-q3' },
  hard: { label: 'СЛОЖНО', badge: 'badge-q4' },
  hardcore: { label: 'ХАРДКОР', badge: 'badge-q1' },
  random: { label: 'СЛУЧАЙНО', badge: 'badge-q6' },
}

const Room = () => {
  const { gameId: gameIdParam } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { socket, emit, on, off } = useSocket()

  const gameId = String(gameIdParam || '').toUpperCase()

  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [snackbar, setSnackbar] = useState({ message: '', type: 'success', visible: false })
  const [spectateInfoOpen, setSpectateInfoOpen] = useState(false)
  const snackTimer = useRef(null)

  useEffect(() => {
    if (gameIdParam && gameIdParam !== gameId) {
      navigate(`/room/${gameId}`, { replace: true })
      return
    }
    loadGame()
  }, [gameId, user, gameIdParam])

  useEffect(() => {
    if (!socket || !gameId || !user) return

    const join = () => emit('JOIN_GAME', { gameId, playerId: user.id, player: user, clientSessionId: getClientSessionId() })
    if (socket.connected) join()
    on('connect', join)

    const handleGameState = (gameData) => {
      setGame(gameData)
      const list = gameData.gamePlayers || []
      setPlayers(list)
      const currentPlayer = list.find((p) => p.player.id === user.id)
      setIsReady(currentPlayer?.isReady || false)
      if (user) {
        setActiveGame(gameData.id, gameData.status === 'active' ? 'active' : 'room')
      }
      if (gameData.status === 'active' && user) {
        navigate(`/game/${gameData.id}`, { replace: true })
      }
    }

    const handleGameStarted = () => navigate(`/game/${gameId}`)
    const handleGameClosed = () => {
      clearActiveGame()
      showSnackbar('Комната закрыта', 'error')
      navigate('/')
    }

    on('GAME_STATE', handleGameState)
    on('GAME_STARTED', handleGameStarted)
    on('GAME_CLOSED', handleGameClosed)

    const handleSessionTakenOver = () => {
      clearActiveGame()
      navigate(`/session-switched?gameId=${encodeURIComponent(gameId)}`, { replace: true })
    }

    on('SESSION_TAKEN_OVER', handleSessionTakenOver)


    const handleError = (err) => {
      const msg = err?.message || err?.error || 'Ошибка'
      if (String(msg).toLowerCase().includes('комната не найдена')) {
        clearActiveGame()
        showSnackbar('Комната не найдена', 'error')
        navigate('/', { replace: true })
        return
      }
      showSnackbar(msg, 'error')
    }

    on('ERROR', handleError)

    return () => {
      off('GAME_STATE')
      off('GAME_STARTED')
      off('GAME_CLOSED')
      off('SESSION_TAKEN_OVER')
      off('ERROR')
      off('connect', join)
    }
  }, [socket, gameId, user, emit, on, off, navigate])

  const loadGame = async () => {
    try {
      setLoading(true)
      const response = await gameAPI.get(gameId)
      setGame(response.data)
      setPlayers(response.data.gamePlayers || [])
      const currentPlayer = response.data.gamePlayers?.find((p) => p.player.id === user?.id)
      setIsReady(currentPlayer?.isReady || false)
      if (user) {
        setActiveGame(response.data.id, response.data.status === 'active' ? 'active' : 'room')
        if (response.data.status === 'active') {
          navigate(`/game/${response.data.id}`, { replace: true })
        } else if (response.data.status === 'finished') {
          clearActiveGame()
          navigate('/', { replace: true })
        }
      }
    } catch (error) {
      clearActiveGame()
      setGame(null)
    } finally {
      setLoading(false)
    }
  }

  const startGame = () => emit('START_GAME', { gameId })

  const toggleReady = () => {
    const newReadyState = !isReady
    emit('PLAYER_READY', { gameId, playerId: user.id, isReady: newReadyState })
    setIsReady(newReadyState)

    // Оптимистично обновляем локальное состояние, чтобы кнопка «Старт»
    // корректно разблокировалась даже при небольшой задержке сокета.
    setPlayers((prev) =>
      prev.map((gp) =>
        gp.player?.id === user.id
          ? {
              ...gp,
              isReady: newReadyState,
            }
          : gp
      )
    )
  }

  const leaveGame = () => {
    emit('LEAVE_GAME', { gameId, playerId: user.id })
    clearActiveGame()
    navigate('/')
  }

  const showSnackbar = (message, type = 'success') => {
    if (snackTimer.current) clearTimeout(snackTimer.current)
    setSnackbar({ message, type, visible: true })
    snackTimer.current = setTimeout(() => setSnackbar((prev) => ({ ...prev, visible: false })), 2000)
  }

  const copyToClipboard = async (text, message = 'Скопировано') => {
    try {
      await navigator.clipboard.writeText(text)
      showSnackbar(message, 'success')
    } catch {
      showSnackbar('Не удалось скопировать', 'error')
    }
  }

  const isOrganizer = game?.organizerId === user?.id
  const spectateUrl = useMemo(() => `${window.location.origin}/spectate/${gameId}`, [gameId])
  const joinUrl = useMemo(() => `${window.location.origin}/${gameId}`, [gameId])
  const readyPlayers = players.filter((p) => p.isReady).length
  const totalPlayers = players.length
  const canStart = isOrganizer && isReady && totalPlayers > 0
  const topicLabel = game?.topicName || game?.topic || ''

  const copySpectateLink = async () => {
    try {
      await navigator.clipboard.writeText(spectateUrl)
      setSpectateInfoOpen(true)
    } catch {
      showSnackbar('Не удалось скопировать', 'error')
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="card w-full max-w-sm bg-base-200 shadow-xl">
          <div className="card-body space-y-4 text-center">
            <div className="text-lg font-semibold">Чтобы подключиться к комнате, нужно авторизоваться.</div>
            <button
              className="btn btn-primary w-full"
              onClick={() => {
                navigate('/')
              }}
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (!game) {
    return <RoomNotFound onGoHome={() => navigate('/')} />;
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body space-y-4 text-center">
            <div className="text-xl font-bold">Комната не найдена</div>
            <p className="opacity-70">Проверь код комнаты или попробуй создать новую.</p>
            <div className="flex gap-2 justify-center">
              <button className="btn btn-primary" onClick={() => navigate('/')}>На главную</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const shareJoinUrl = async () => {
    // Telegram WebApp: copy link (fallback) + open share UI in Telegram.
    await copyToClipboard(joinUrl, 'Ссылка для входа скопирована')

    const tg = getTelegramWebApp()
    const shareLink = `https://t.me/share/url?url=${encodeURIComponent(joinUrl)}&text=${encodeURIComponent(
      `Quizzy: присоединяйся к комнате ${gameId}`
    )}`

    try {
      if (tg && typeof tg.openTelegramLink === 'function') {
        tg.openTelegramLink(shareLink)
        return
      }
      if (tg && typeof tg.openLink === 'function') {
        tg.openLink(shareLink)
        return
      }
    } catch {
      // ignore
    }
  }

  const openSpectateLink = () => {
    const url = spectateUrl
    if (!url) return

    if (isTelegramWebApp()) {
      showSnackbar('Откройте ссылку на трансляцию в обычном браузере на другом устройстве', 'success')
      return
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      {/* Комната */}
      <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible w-full max-w-[600px] mx-auto shrink-0 mt-3">
        <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
          Комната
        </div>
        <div className="card-body px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="text-3xl font-black tracking-wide text-white cursor-pointer select-text"
                onClick={() => copyToClipboard(gameId, 'Код скопирован')}
                title="Скопировать код комнаты"
              >
                {gameId}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(gameId, 'Код скопирован')}
                  className="w-11 h-11 rounded-xl bg-[#2b2f3d] active:bg-[#353b4c] transition-colors flex items-center justify-center text-white"
                  title="Скопировать код комнаты"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() =>
                    isTelegramWebApp() ? shareJoinUrl() : copyToClipboard(joinUrl, 'Ссылка для входа скопирована')
                  }
                  className="w-11 h-11 rounded-xl bg-[#2b2f3d] active:bg-[#353b4c] transition-colors flex items-center justify-center text-white"
                  title={isTelegramWebApp() ? 'Поделиться ссылкой' : 'Скопировать ссылку для входа'}
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`badge text-xs shrink-0 ${difficultyMeta[game.difficulty]?.badge || 'badge-q6'}`}>
                {difficultyMeta[game.difficulty]?.label || game.difficulty}
              </span>
              <div className="text-lg font-semibold text-white truncate min-w-0" title={topicLabel}>
                {topicLabel}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                onClick={leaveGame}
                className="flex-1 h-11 rounded-full text-white font-semibold inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#000', boxShadow: 'none', border: 'none', padding: '0 16px' }}
              >
                <Leave size={16} />
                Выйти
              </button>
              <button
                onClick={toggleReady}
                className="flex-1 h-11 rounded-full text-white font-semibold inline-flex items-center justify-center gap-2"
                style={{
                  backgroundColor: isReady ? '#22c55e' : '#6b7280',
                  boxShadow: 'none',
                  border: 'none',
                  padding: '0 16px'
                }}
              >
                <CheckCircle2 size={18} />
                {isReady ? 'Готов' : 'Готов?'}
              </button>
            </div>
            {isOrganizer && (
              <button
                onClick={startGame}
                className={`btn btn-primary gap-2 px-6 rounded-full w-full ${!canStart ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!canStart}
              >
                <Play size={18} />
                Старт
              </button>
            )}
            {isOrganizer && (
              <button onClick={copySpectateLink} className="btn btn-secondary gap-2 px-6 rounded-full w-full">
                <Tv size={18} />
                Режим трансляции
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Игроки */}
      <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible w-full max-w-[600px] mx-auto flex-1 min-h-0 flex flex-col">
        <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
          Игроки {readyPlayers}/{totalPlayers}
        </div>
        <div className="card-body pt-8 pb-6 px-6 flex-1 min-h-0">
          <div className="scroll-mask flex-1 min-h-0 overflow-y-auto">
            {players.map((gamePlayer, index) => {
              const isOnline = gamePlayer.isOnline !== false
              return (
                <div
                  key={gamePlayer.player.id}
                  className={`flex items-center gap-4 p-4 bg-base-200 rounded-xl mb-3 last:mb-0 border ${gamePlayer.player.id === user.id ? 'border-[#e5d423]' : 'border-[#3a4de6]'} ${!isOnline ? 'opacity-60 grayscale' : ''}`}
                >
                  <div className="text-lg font-bold text-white w-8 text-center">#{index + 1}</div>

                  <div className="relative">
                    <div className="avatar">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
                        {gamePlayer.player.avatarUrl ? (
                          <img
                            src={gamePlayer.player.avatarUrl}
                            alt={gamePlayer.player.username}
                            className="rounded-full"
                          />
                        ) : (
                          <span className="text-sm font-bold">
                            {gamePlayer.player.username?.charAt(0) || 'U'}
                          </span>
                        )}
                      </div>
                    </div>
                    {gamePlayer.player.id === game.organizerId && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs leading-none text-[#e5d423]">
                        ⭐
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold">
                      {gamePlayer.player.username || `${gamePlayer.player.firstName || ''} ${gamePlayer.player.lastName || ''}`.trim()}
                    </div>
                    <div className="text-sm flex items-center gap-1 text-[#e5d423]">
                      <span role="img" aria-label="trophy">🏆</span>
                      <span>{gamePlayer.player.totalScore}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <CheckCircle2 size={18} className={gamePlayer.isReady ? 'text-green-400' : 'text-gray-500'} />
                  </div>
                </div>
              )
            })}

            {players.length === 0 && (
              <div className="text-center py-8 opacity-50">
                <Users size={48} className="mx-auto mb-4" />
                <p>Пока никто не подключился...</p>
                <p className="text-sm">Поделись ссылкой, чтобы друзья присоединились.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {spectateInfoOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="card glass-card shadow-2xl border border-base-300/60 w-full max-w-md">
            <div className="card-body space-y-4 text-center">
              <div className="text-xl font-black">Ссылка скопирована</div>
              <a
                href={spectateUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 font-semibold break-all underline underline-offset-4"
                onClick={(e) => {
                  e.preventDefault()
                  openSpectateLink()
                }}
              >
                {spectateUrl}
              </a>
              <div className="opacity-80">
                Откройте её на устройстве с большим экраном, чтобы все участники могли наблюдать за игрой.
              </div>
              <button className="btn btn-primary w-full rounded-full" onClick={() => setSpectateInfoOpen(false)}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </div>
  )
}

export default Room
