import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { gameAPI, questionAPI } from '../utils/api'
import { Play } from 'lucide-react'
import Snackbar from '../components/feedback/Snackbar'
import DifficultyModal from '../components/modals/DifficultyModal'

const difficulties = [
  { id: 'easy', name: 'Легко', color: 'badge-q2', description: 'Подходит для разогрева' },
  { id: 'medium', name: 'Средне', color: 'badge-q3', description: 'Чуть сложнее, но без боли' },
  { id: 'hard', name: 'Сложно', color: 'badge-q4', description: 'Нужны знания и скорость' },
  { id: 'hardcore', name: 'Хардкор', color: 'badge-q1', description: 'Для сильных духом' },
]

const getTopicSlug = (topic) => {
  if (topic?.slug) return topic.slug
  const raw = (topic?.name || topic?.id || 'default').toString().toLowerCase()
  return raw.replace(/[^a-z0-9а-яё]+/gi, '_')
}

const DEFAULT_TOPIC_IMG = '/topics/default.jpg'

const Home = () => {
  const { user, isAuthenticated } = useAuth()
  const { features } = useConfig()
  // Требуем авторизацию
  if (!user) return <Navigate to="/welcome" replace />

  const navigate = useNavigate()

  const [topics, setTopics] = useState([])
  const [loadingTopics, setLoadingTopics] = useState(true)

  const [gameCode, setGameCode] = useState('')
  const [creating, setCreating] = useState(false)

  const [selectedTopic, setSelectedTopic] = useState(null)
  const modalRef = useRef(null)

  const [snackbar, setSnackbar] = useState({ message: '', type: 'success', visible: false })
  const snackTimer = useRef(null)

  // для защиты от "клик после скролла" (и для Android drag-scroll фикса)
  const topicsScrollRef = useRef(null)
  const isScrollingRef = useRef(false)
  const scrollResetTimer = useRef(null)

  const isAndroid = useMemo(() => /Android/i.test(navigator?.userAgent || ''), [])

  // Telegram WebApp (в т.ч. Android WebView)
  const isWebApp = useMemo(() => Boolean(window?.Telegram?.WebApp?.initData), [])

  // Важно: если пользователь не авторизован — показываем экран входа,
  // а не основной Home (иначе человек видит темы, но дальше всё равно упрётся в авторизацию).

  const showSnackbar = (message, type = 'success') => {
    if (snackTimer.current) clearTimeout(snackTimer.current)
    setSnackbar({ message, type, visible: true })
    snackTimer.current = setTimeout(() => setSnackbar((prev) => ({ ...prev, visible: false })), 2000)
  }

  useEffect(() => {
    const el = topicsScrollRef.current
    if (!el) return

    const markScrolling = () => {
      isScrollingRef.current = true
      if (scrollResetTimer.current) clearTimeout(scrollResetTimer.current)
      scrollResetTimer.current = setTimeout(() => {
        isScrollingRef.current = false
      }, 140)
    }

    // ✅ Android Telegram WebView: первый drag-scroll иногда "залипает".
    // Решение: делаем контролируемый drag-scroll на контейнере (без инерции),
    // чтобы WebView не перехватывал gesture в long-press/image-drag режим.
    let dragging = false
    let startY = 0
    let startScrollTop = 0

    const onTouchStart = (e) => {
      if (!isAndroid || !isWebApp) return
      if (!e.touches || e.touches.length !== 1) return
      dragging = true
      startY = e.touches[0].clientY
      startScrollTop = el.scrollTop
    }

    const onTouchMove = (e) => {
      markScrolling()
      if (!dragging) return
      if (!isAndroid || !isWebApp) return
      if (!e.touches || e.touches.length !== 1) return

      const y = e.touches[0].clientY
      const dy = y - startY
      el.scrollTop = startScrollTop - dy

      // Ключевой момент: запрещаем браузеру пытаться делать что-то другое с gesture
      // (контекстное меню/drag/selection), иначе он "обрубает" нативный scroll.
      e.preventDefault()
    }

    const onTouchEnd = () => {
      dragging = false
      markScrolling()
    }

    // scroll - пассивно
    el.addEventListener('scroll', markScrolling, { passive: true })

    // touchstart/touchend - пассивно, touchmove - НЕ пассивно (нам нужен preventDefault)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('scroll', markScrolling)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      if (scrollResetTimer.current) clearTimeout(scrollResetTimer.current)
    }
  }, [topicsScrollRef, isAndroid, isWebApp])

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setLoadingTopics(true)
        const res = await questionAPI.getTopics()
        setTopics(Array.isArray(res.data) ? res.data : [])
      } catch (e) {
        setTopics([])
        showSnackbar('Не удалось загрузить темы', 'error')
      } finally {
        setLoadingTopics(false)
      }
    }

    fetchTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const joinGame = () => {
    const code = gameCode.trim().toUpperCase()
    if (!code) {
      showSnackbar('Введи код комнаты', 'error')
      return
    }
    navigate(`/room/${code}`)
  }

  const openModal = (topic) => {
    if (!features?.difficultySelection) {
      createGame(topic.id, 'random')
      return
    }
    setSelectedTopic(topic)
    modalRef.current?.showModal?.()
  }

  const closeModal = () => {
    modalRef.current?.close?.()
    setSelectedTopic(null)
  }

  const createGame = async (topicId, difficultyId) => {
    if (!isAuthenticated) return
    setCreating(true)
    try {
      const payload = { topicId }
      if (features?.difficultySelection && difficultyId) {
        payload.difficulty = difficultyId
      }
      const response = await gameAPI.create(payload)
      closeModal()
      navigate(`/room/${response.data.id}`)
    } catch (error) {
      showSnackbar('Не удалось создать комнату', 'error')
    } finally {
      setCreating(false)
    }
  }

  const onTopicClick = (topic) => {
    // Если пользователь прямо сейчас скроллит - не открываем модалку
    if (isScrollingRef.current) return
    openModal(topic)
  }

  // Если пользователь не авторизован в вебе — показываем welcome/login экран.
  // (В Telegram WebApp авторизация может происходить "тихо" через initData —
  // поэтому там продолжаем показывать Home.)
  if (!isAuthenticated && !isWebApp) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="card w-full max-w-sm bg-base-200 shadow-xl">
          <div className="card-body space-y-4 text-center">
            <div className="text-lg font-semibold">Войди, чтобы создавать комнаты и играть.</div>
            
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      {/* Подключиться */}
      <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible w-full max-w-[600px] mx-auto shrink-0 mt-3">
        <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
          Подключиться
        </div>
        <div className="card-body px-6 py-4 flex flex-col justify-center">
          <div className="w-full h-12 flex items-center rounded-xl overflow-hidden bg-base-200 room-join mt-4">
            <input
              type="text"
              placeholder="Введи код комнаты"
              className="flex-1 h-12 px-4 room-join-input bg-transparent text-white placeholder:text-white/70 border-0 focus:outline-none focus:ring-0 rounded-l-xl"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
              inputMode="text"
              autoCapitalize="characters"
            />
            <button
              onClick={joinGame}
              className="h-12 w-[96px] px-2 font-semibold text-white flex items-center justify-center text-sm sm:text-base leading-none text-center"
              style={{ backgroundColor: '#142e58' }}
              type="button"
            >
              Войти
            </button>
          </div>
        </div>
      </div>

      {/* Создать игру */}
      <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible w-full max-w-[600px] mx-auto flex-1 min-h-0 flex flex-col">
        <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
          Создать игру
        </div>

        <div className="card-body pt-8 pb-6 px-6 flex-1 min-h-0">
          {loadingTopics ? (
            <div className="flex justify-center items-center h-40">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <div
              ref={topicsScrollRef}
              className="scroll-mask grid grid-cols-1 gap-3 flex-1 min-h-0 overflow-y-auto"
            >
              {topics.map((topic) => {
                const slug = getTopicSlug(topic)
                const imgUrl = `/topics/${slug}.jpg`

                return (
                  <div
                    key={topic.id}
                    role="button"
                    tabIndex={0}
                    className="topic-card relative rounded-2xl overflow-hidden select-none h-[200px] sm:h-[300px]"
                    style={{ backgroundColor: '#142e58' }}
                    onClick={() => onTopicClick(topic)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onTopicClick(topic)
                    }}
                    onContextMenu={(e) => e.preventDefault()} // Android long-press sometimes breaks scrolling/clicks
                  >
                    <div className="absolute inset-0 pointer-pass">
                      <img
                        src={imgUrl}
                        alt={topic.name || topic.id}
                        loading="lazy"
                        decoding="async"
                        width="640"
                        height="360"
                        draggable={false}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          if (e.currentTarget.src.endsWith(DEFAULT_TOPIC_IMG)) return
                          e.currentTarget.src = DEFAULT_TOPIC_IMG
                        }}
                      />
                      <div
                        className="absolute inset-0 pointer-pass"
                        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.70))' }}
                      />
                    </div>

                    <div className="absolute inset-0 flex items-end px-4 py-4 text-white pointer-pass">
                      <div className="flex items-end justify-between w-full gap-3">
                        <span className="font-bold text-2xl drop-shadow">{topic.name}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {topics.length === 0 && (
                <div className="text-center py-8 opacity-50">
                  <p>Темы не найдены</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Выбор сложности */}
      <DifficultyModal modalRef={modalRef} topic={selectedTopic} difficulties={difficulties} onStart={createGame} onClose={closeModal} />

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </div>
  )
}

export default Home
