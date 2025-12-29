import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Tv, UserPlus, HelpCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { gameAPI, questionAPI } from '../utils/api'
import { clearActiveGame, getClientSessionId, setActiveGame } from '../utils/storage'
import { buildTelegramMiniAppUrl, getTelegramWebApp, isTelegramWebApp } from '../utils/telegram'
import Snackbar from '../components/feedback/Snackbar'
import RoomNotFound from '../components/room/RoomNotFound'
import RoomFull from '../components/room/RoomFull'
import SectionHeader from '../components/layout/SectionHeader'
import PlayerTile from '../components/players/PlayerTile'
import AppModal from '../components/modals/AppModal'
import LoadingScreen from '../components/feedback/LoadingScreen'

const palette = {
  primary: 'var(--qz-blue)',
  primary10: 'var(--qz-blue-10)',
  text: 'var(--qz-text)',
  muted: 'var(--qz-gray)',
  border: 'var(--qz-black-5)',
  white: 'var(--qz-white)',
  yellow: 'var(--qz-yellow)',
  success: 'var(--qz-success)',
}

export default function Room() {
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
  const [roomFull, setRoomFull] = useState(false)
  const [joinBlocked, setJoinBlocked] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [startConfirmOpen, setStartConfirmOpen] = useState(false)

  const [topicSlug, setTopicSlug] = useState('default')
  const [collectionName, setCollectionName] = useState('Микс Базовый')
  const showGlobalLoading = authLoading || loading

  const snackTimer = useRef(null)
  const playersScrollRef = useRef(null)

  const ensureSelfInPlayers = (list) => {
    const arr = Array.isArray(list) ? list : []
    if (!user?.id) return arr
    if (arr.some((gp) => gp?.player?.id === user.id)) return arr
    return [...arr, { player: user, isReady: false, isOnline: true }]
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

  const loadGame = async () => {
    try {
      setLoading(true)
      const response = await gameAPI.get(gameId)
      setGame(response.data)
      const list = ensureSelfInPlayers(response.data.gamePlayers || [])
      setPlayers(list)
      const currentPlayer = list.find((p) => p.player.id === user?.id)
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
    } catch {
      clearActiveGame()
      setGame(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (gameIdParam && gameIdParam !== gameId) {
      navigate(`/room/${gameId}`, { replace: true })
      return
    }
    loadGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user, gameIdParam])

  useEffect(() => {
    if (!socket || !gameId || !user) return

    const handleGameState = (gameData) => {
      setGame(gameData)
      const list = ensureSelfInPlayers(gameData.gamePlayers || [])
      setPlayers(list)
      const currentPlayer = list.find((p) => p.player.id === user.id)
      setIsReady(currentPlayer?.isReady || false)
      setActiveGame(gameData.id, gameData.status === 'active' ? 'active' : 'room')
      if (gameData.status === 'active') navigate(`/game/${gameData.id}`, { replace: true })
    }

    const handleGameClosed = () => {
      clearActiveGame()
      showSnackbar('Комната закрыта', 'error')
      navigate('/', { replace: true })
    }

    const handleError = (err) => {
      const msg = String(err?.message || err?.error || 'Ошибка')
      if (msg.toLowerCase().includes('full')) {
        clearActiveGame()
        setJoinBlocked(true)
        setRoomFull(true)
        showSnackbar('Комната заполнена', 'error')
        return
      }
      showSnackbar(msg, 'error')
    }

    on('GAME_STATE', handleGameState)
    on('GAME_CLOSED', handleGameClosed)
    on('ERROR', handleError)

    const join = () => {
      if (joinBlocked) return
      emit('JOIN_GAME', { gameId, playerId: user.id, player: user, clientSessionId: getClientSessionId() })
      setPlayers((prev) => ensureSelfInPlayers(prev))
    }

    if (socket.connected) join()
    on('connect', join)

    return () => {
      off('GAME_STATE', handleGameState)
      off('GAME_CLOSED', handleGameClosed)
      off('ERROR', handleError)
      off('connect', join)
    }
  }, [socket, gameId, user, emit, on, off, navigate, joinBlocked])

  const isOrganizer = game?.organizerId === user?.id

  useEffect(() => {
    if (!game?.topicId) return
    let active = true

    const collectionId = Array.isArray(game?.collectionIds) && game.collectionIds.length ? game.collectionIds[0] : null

    ;(async () => {
      try {
        const [{ data: topics }, { data: collectionsData }] = await Promise.all([
          questionAPI.getTopics(),
          questionAPI.getTopicCollections(game.topicId),
        ])
        if (!active) return

        const t = Array.isArray(topics) ? topics.find((x) => Number(x.id) === Number(game.topicId)) : null
        setTopicSlug(t?.slug || 'default')

        const collections = Array.isArray(collectionsData?.collections) ? collectionsData.collections : []
        const picked = collectionId ? collections.find((c) => Number(c.id) === Number(collectionId)) : null
        setCollectionName(picked?.name || (collections[0]?.name ?? 'Микс Базовый'))
      } catch {
        if (!active) return
        setTopicSlug('default')
      }
    })()

    return () => {
      active = false
    }
  }, [game?.topicId, game?.collectionIds])

  useEffect(() => {
    const el = playersScrollRef.current
    if (!el) return

    const isAndroid = /Android/i.test(navigator.userAgent || '')
    const isWebApp = isTelegramWebApp()
    if (!isAndroid || !isWebApp) return

    let dragging = false
    let startY = 0
    let startScrollTop = 0

    const onTouchStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return
      dragging = true
      startY = e.touches[0].clientY
      startScrollTop = el.scrollTop
    }

    const onTouchMove = (e) => {
      if (!dragging) return
      if (!e.touches || e.touches.length !== 1) return
      const y = e.touches[0].clientY
      const dy = y - startY
      el.scrollTop = startScrollTop - dy
      e.preventDefault()
    }

    const onTouchEnd = () => {
      dragging = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [game?.id])

  const startGame = () => emit('START_GAME', { gameId })

  const toggleReady = () => {
    const newReadyState = !isReady
    emit('PLAYER_READY', { gameId, playerId: user.id, isReady: newReadyState })
    setIsReady(newReadyState)
    setPlayers((prev) =>
      prev.map((gp) => (gp.player?.id === user.id ? { ...gp, isReady: newReadyState } : gp))
    )
  }

  const leaveGame = () => {
    if (user?.id) emit('LEAVE_GAME', { gameId, playerId: user.id })
    clearActiveGame()
    navigate('/', { replace: true })
  }

  const requestLeave = () => setLeaveOpen(true)

  const totalPlayers = players.length
  const readyPlayers = players.filter((p) => p.isReady).length
  const allReady = totalPlayers > 0 && readyPlayers === totalPlayers

  const topicImageSrc = `/topics/${topicSlug || 'default'}.jpg`

  const joinUrl = useMemo(() => `${window.location.origin}/${gameId}`, [gameId])
  const tgDeepLink = useMemo(() => buildTelegramMiniAppUrl(gameId) || joinUrl, [gameId, joinUrl])

  const shareInviteLink = async () => {
    const url = tgDeepLink
    const text = `Quizzy: подключайся к комнате ${gameId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Quizzy', text, url })
        return
      }
    } catch {
      // ignore and fallback to clipboard
    }
    await copyToClipboard(url, 'Ссылка скопирована')
  }

  const shareJoinUrl = async () => {
    await copyToClipboard(joinUrl, 'Ссылка для входа скопирована')
    const tg = getTelegramWebApp()
    const shareLink = `https://t.me/share/url?url=${encodeURIComponent(joinUrl)}&text=${encodeURIComponent(
      `Quizzy: подключайся к комнате ${gameId}`
    )}`
    try {
      if (tg && typeof tg.openTelegramLink === 'function') return tg.openTelegramLink(shareLink)
      if (tg && typeof tg.openLink === 'function') return tg.openLink(shareLink)
    } catch {
      // ignore
    }
  }

  const spectateUrl = useMemo(() => `${window.location.origin}/spectate/${gameId}`, [gameId])
  const openSpectateLink = () => {
    if (isTelegramWebApp()) {
      copyToClipboard(spectateUrl, 'Ссылка на ТВ-режим скопирована')
      return
    }
    try {
      window.open(spectateUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // ignore
    }
  }

  if (!user && !authLoading) return <Navigate to="/welcome" replace />

  if (roomFull) {
    return <RoomFull gameId={gameId} onGoHome={() => navigate('/')} />
  }

  if (loading || authLoading) {
    return <LoadingScreen message="Загружаем комнату" subtext="Получаем список игроков и тему" />
  }

  if (!game) return <RoomNotFound onGoHome={() => navigate('/')} />
  const bottomLabel = `Готовы ${readyPlayers} игроков из ${totalPlayers}`
  const readyLabel = isReady ? 'Ждем запуска' : 'Готов'
  const readyBg = isReady ? palette.primary10 : palette.primary
  const readyFg = isReady ? palette.primary : palette.white
  const canStart = isOrganizer && allReady
  const startBg = canStart ? palette.success : palette.border
  const startFg = canStart ? palette.white : palette.text

  return (
    <div className="-mx-4 -my-4 flex flex-col flex-1 min-h-0 bg-white">
      <LoadingScreen
        visible={showGlobalLoading}
        minDuration={600}
        message={authLoading ? 'Подключаемся' : 'Загружаем комнату'}
        subtext={authLoading ? 'Проверяем ваш профиль' : 'Получаем список игроков и тему'}
      />
      <SectionHeader
        title={`Комната ${gameId}`}
        backTo="/"
        onBack={requestLeave}
        backVariant="exit"
        right={
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="w-11 h-11 rounded-full bg-[var(--qz-blue-10)] flex items-center justify-center text-[var(--qz-blue)]"
            aria-label="Инфо"
            title="Инфо"
          >
            <HelpCircle className="w-6 h-6" />
          </button>
        }
      />

      <div className="flex-1 min-h-0 overflow-hidden px-3">
        <div className="pt-3 flex flex-col gap-3 h-full min-h-0">
            <div className="relative w-full h-[170px] rounded-[20px] overflow-hidden bg-[var(--qz-black)] shrink-0">
              <img src={topicImageSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />
              <div className="absolute left-4 right-4 bottom-4">
                <div className="text-[var(--qz-yellow)] text-[18px] leading-[22px] font-extrabold">{collectionName}</div>
              </div>
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex-1 h-11 rounded-[12px] bg-[var(--qz-blue-10)] text-[var(--qz-blue)] font-semibold flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Пригласить
              </button>

              {isOrganizer ? (
                <button
                  type="button"
                  onClick={openSpectateLink}
                  className="flex-1 h-11 rounded-[12px] bg-[var(--qz-blue-10)] text-[var(--qz-text)] font-semibold flex items-center justify-center gap-2"
                >
                  <Tv className="w-5 h-5" />
                  ТВ-режим
                </button>
              ) : null}
            </div>

            <div className="bg-white rounded-[12px] border overflow-hidden flex-1 min-h-0 flex flex-col" style={{ borderColor: 'var(--qz-black-5)' }}>
              <div ref={playersScrollRef} className="scroll-mask">
                <div>
                  {players.map((gp, idx) => (
                    <div key={gp.player.id}>
                      <div className="px-4">
                        <PlayerTile
                          mode="room"
                          player={gp.player}
                          isOnline={gp.isOnline !== false}
                          isSelf={gp.player.id === user.id}
                          isOrganizer={game?.organizerId ? gp.player.id === game.organizerId : false}
                          isReady={!!gp.isReady}
                        />
                      </div>
                      {idx !== players.length - 1 ? <div className="h-px mx-4" style={{ backgroundColor: 'var(--qz-black-5)' }} /> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="shrink-0 bg-white px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 34px)' }}>
        <div className="py-3 flex items-center justify-center text-[15px] leading-[22px] text-[var(--qz-gray)]">
          {bottomLabel}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={toggleReady}
            className="flex-1 h-[50px] rounded-[10px] text-[17px] leading-[22px] font-semibold"
            style={{ backgroundColor: readyBg, color: readyFg }}
          >
            {readyLabel}
          </button>
          {isOrganizer ? (
            <button
              type="button"
              aria-disabled={!canStart}
              onClick={() => (canStart ? startGame() : setStartConfirmOpen(true))}
              className="flex-1 h-[50px] rounded-[10px] text-[17px] leading-[22px] font-semibold"
              style={{ backgroundColor: startBg, color: startFg }}
            >
              Запуск
            </button>
          ) : null}
        </div>
      </div>

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />

      <AppModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        closeOnBackdrop={false}
        imageSrc="/media/pictures/info-cat.svg"
        title="Игровой процесс"
        primaryAction={{ label: 'Ясно', onClick: () => setInfoOpen(false), variant: 'primary' }}
      >
        <div className="space-y-4">
          <p>
            Викторина состоит из 10 вопросов. Если знаешь ответ — отметь его и нажми кнопку «Подтвердить».
            Ответ нужно подтвердить в течение 20 секунд.
          </p>
          <p>
            Когда ответят все игроки или истечет время, будет показан правильный ответ и начислены очки тем, кто ответил
            правильно. Затем начнется следующий вопрос.
          </p>
          <p>
            Если в вопросе нужно расставить варианты по порядку — нажимай их в нужной последовательности. Нажав на
            выбранный вариант повторно, ты отменишь выбор.
          </p>
        </div>
      </AppModal>

      <AppModal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        closeOnBackdrop={false}
        imageSrc="/media/pictures/info-cat.svg"
        title="Выйти из комнаты?"
        primaryAction={{ label: 'Покинуть', onClick: leaveGame, variant: 'danger' }}
        secondaryAction={{ label: 'Остаться', onClick: () => setLeaveOpen(false), variant: 'secondary' }}
      >
        Вы вернетесь на главный экран и не будете участвовать в викторине.
      </AppModal>

      <AppModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        closeOnBackdrop={false}
        primaryAction={{ label: 'Поделиться', onClick: shareInviteLink, variant: 'primary' }}
      >
        <div className="flex flex-col items-center">
          <div className="bg-white p-3 rounded-[16px] border" style={{ borderColor: 'var(--qz-black-5)' }}>
            <QRCodeSVG value={tgDeepLink} size={220} includeMargin />
          </div>

          <div className="mt-4 text-center text-[17px] leading-[26px] text-[var(--qz-gray)]">
            <div>Сообщите игроку код комнаты</div>
            <button
              type="button"
              onClick={() => copyToClipboard(gameId, 'Код комнаты скопирован')}
              className="mt-2 text-[32px] leading-[36px] font-extrabold tracking-[2px] text-[var(--qz-text)]"
            >
              {gameId}
            </button>
          </div>

          <div className="mt-3 text-[17px] leading-[26px] text-[var(--qz-gray)]">или отправьте ссылку</div>
        </div>
      </AppModal>

      <AppModal
        open={startConfirmOpen}
        onClose={() => setStartConfirmOpen(false)}
        closeOnBackdrop={false}
        title="Не все игроки готовы"
        primaryAction={{
          label: 'Запуск',
          variant: 'success',
          onClick: () => {
            setStartConfirmOpen(false)
            startGame()
          },
        }}
      >
        Игра начнется для всех игроков в комнате не смотря на их статус готовности
      </AppModal>
    </div>
  )
}
