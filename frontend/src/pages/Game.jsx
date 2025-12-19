import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useSocket } from '../hooks/useSocket'
import { clearActiveGame, getClientSessionId, setActiveGame } from '../utils/storage'
import { Clock, Users, Trophy, Zap, CheckCircle2, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import Snackbar from '../components/feedback/Snackbar'

const PHASES = {
  LOADING: 'loading',
  QUESTION: 'question',
  REVEAL: 'reveal',
  SCORING: 'scoring',
  FINISHED: 'finished',
}

const shuffleArray = (arr) => {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

const parseOptions = (question) => {
  if (!question) return []
  if (Array.isArray(question.options)) return question.options
  try {
    return JSON.parse(question.options || '[]')
  } catch {
    return []
  }
}

const buildShuffledOptions = (options) =>
  shuffleArray((options || []).map((text, originalIndex) => ({ text, originalIndex })))

const safePath = (file) => (file || '').replace(/^[./\\]+/, '')

const normalizeMediaUrl = (file, folder) => {
  if (!file) return null
  const v = String(file).trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('/')) return v
  let rel = safePath(v)
  const p1 = `media/${folder}/`
  const p2 = `${folder}/`
  if (rel.toLowerCase().startsWith(p1.toLowerCase())) rel = rel.slice(p1.length)
  else if (rel.toLowerCase().startsWith(p2.toLowerCase())) rel = rel.slice(p2.length)
  return `/media/${folder}/${rel}`
}

const isPlaceholderMedia = (url) => url === '/media/placeholder.png'

const Game = () => {
  const { gameId: gameIdParam } = useParams()
  const { user, refreshMe } = useAuth()
  const { features } = useConfig()

  const { socket, emit, on, off } = useSocket()
  const navigate = useNavigate()

  const gameId = String(gameIdParam || '').toUpperCase()

  const [phase, setPhase] = useState(PHASES.LOADING)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [shuffledOptions, setShuffledOptions] = useState([]) // [{ text, originalIndex }]
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [questionDuration, setQuestionDuration] = useState(15)
  const [revealDuration, setRevealDuration] = useState(5)
  const [selectedOption, setSelectedOption] = useState(null)
  const [sequenceOrder, setSequenceOrder] = useState([])
  const [submittedSequence, setSubmittedSequence] = useState(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [correctSequence, setCorrectSequence] = useState(null)
  const [players, setPlayers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [flashCorrect, setFlashCorrect] = useState(false)
  const [organizerId, setOrganizerId] = useState(null)
  const [barKey, setBarKey] = useState(0)
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const [mediaHint, setMediaHint] = useState({ audio: false, video: false })
  const [mediaVolume, setMediaVolume] = useState(0.9) // 0..1
  const [mediaMuted, setMediaMuted] = useState(false)
  const [snackbar, setSnackbar] = useState({ message: '', type: 'success', visible: false })
  const snackTimer = useRef(null)
  const lastQuestionIdRef = useRef(null)
  const scoringTimersRef = useRef([])
  const [scoreOverlay, setScoreOverlay] = useState({
    visible: false,
    hiding: false,
    step: 'idle', // idle | before | updated | reordered
    changedIds: [],
    displayPlayers: [],
    beforeById: {},
    afterById: {},
  })
  const scoreRowRefs = useRef(new Map())
  const prevScoreRowTops = useRef(new Map())

  const showSnackbar = (message, type = 'success') => {
    if (snackTimer.current) clearTimeout(snackTimer.current)
    setSnackbar({ message, type, visible: true })
    snackTimer.current = setTimeout(() => setSnackbar((prev) => ({ ...prev, visible: false })), 2000)
  }

  const clearScoringTimers = () => {
    for (const t of scoringTimersRef.current) clearTimeout(t)
    scoringTimersRef.current = []
  }

  const getPublicPlayerId = (p) => p?.playerId ?? p?.player?.id ?? null

  useLayoutEffect(() => {
    if (!scoreOverlay.visible) {
      prevScoreRowTops.current = new Map()
      return
    }

    const nextTops = new Map()
    for (const [id, el] of scoreRowRefs.current.entries()) {
      if (!el) continue
      nextTops.set(id, el.getBoundingClientRect().top)
    }

    for (const [id, el] of scoreRowRefs.current.entries()) {
      if (!el) continue
      const prevTop = prevScoreRowTops.current.get(id)
      const nextTop = nextTops.get(id)
      if (prevTop === undefined || nextTop === undefined) continue
      const delta = prevTop - nextTop
      if (!delta) continue

      el.style.transition = 'transform 0s'
      el.style.transform = `translateY(${delta}px)`
      requestAnimationFrame(() => {
        if (!scoreRowRefs.current.get(id)) return
        el.style.transition = 'transform 850ms ease'
        el.style.transform = ''
      })
    }

    prevScoreRowTops.current = nextTops
  }, [scoreOverlay.visible, scoreOverlay.displayPlayers.map((p) => `${getPublicPlayerId(p) ?? 'x'}:${p?.score ?? 0}`).join('|')])

  useEffect(() => {
    return () => {
      if (snackTimer.current) clearTimeout(snackTimer.current)
      clearScoringTimers()
    }
  }, [])

  useEffect(() => {
    setBarKey(Date.now())
  }, [phase, questionIndex])

  // Таймер обратного отсчёта
  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  // Сокеты
  useEffect(() => {
    if (!socket || !user) return

    if (gameIdParam && gameIdParam !== gameId) {
      navigate(`/game/${gameId}`, { replace: true })
      return
    }

    const handleGameStarted = () => {
      setPhase(PHASES.QUESTION)
    }
    on('GAME_STARTED', handleGameStarted)

    const handleGameLoading = () => {
      setPhase(PHASES.LOADING)
    }
    on('GAME_LOADING', handleGameLoading)

    const handleNewQuestion = (data) => {
      clearScoringTimers()
      setScoreOverlay((prev) => (prev.visible ? { ...prev, visible: false, hiding: false, step: 'idle' } : prev))
      setPhase(PHASES.QUESTION)
      const q = data.question
      // Avoid re-shuffling/resetting the same question if backend re-sends NEW_QUESTION on reconnect/join.
      if (q?.id && lastQuestionIdRef.current === q.id) return
      lastQuestionIdRef.current = q?.id ?? null
      setCurrentQuestion(q)
      const options = parseOptions(q)
      const order = Array.isArray(q?.optionOrder) ? q.optionOrder : null
      const perm =
        order && order.length === options.length
          ? options.map((text, displayIndex) => ({ text, originalIndex: order[displayIndex] ?? displayIndex }))
          : buildShuffledOptions(options)
      setShuffledOptions(perm)
      setQuestionIndex(data.questionIndex)
      setTotalQuestions(typeof data.totalQuestions === 'number' ? data.totalQuestions : 0)
      const qd = Math.max(1, Math.round((data.questionTimeMs || 15000) / 1000))
      const rd = Math.max(1, Math.round((data.revealTimeMs || 5000) / 1000))
      setQuestionDuration(qd)
      setRevealDuration(rd)
      setTimeLeft(qd)
      setSelectedOption(null)
      setSequenceOrder(q?.type === 'sequence' ? Array(perm.length).fill(null) : [])
      setSubmittedSequence(null)
      setHasSubmitted(false)
      setCorrectAnswer(null)
      setCorrectSequence(null)
      setMediaHint({ audio: false, video: false })
    }
    on('NEW_QUESTION', handleNewQuestion)

    const handleQuestionEnded = (data) => {
      clearScoringTimers()
      setPhase(PHASES.REVEAL)
      setCorrectAnswer(data.correctAnswer)
      setCorrectSequence(data.correctSequence || null)
      setTimeLeft(revealDuration)
    }
    on('QUESTION_ENDED', handleQuestionEnded)

    const handleScorePhase = (data) => {
      clearScoringTimers()

      const before = Array.isArray(data?.beforePlayers) ? data.beforePlayers : []
      const after = Array.isArray(data?.afterPlayers) ? data.afterPlayers : []
      const scoringMs = typeof data?.scoringTimeMs === 'number' ? data.scoringTimeMs : 5000
      const hideAnimMs = 220

      const afterById = {}
      for (const p of after) {
        const id = getPublicPlayerId(p)
        if (!id) continue
        afterById[id] = p
      }
      const beforeById = {}
      for (const p of before) {
        const id = getPublicPlayerId(p)
        if (!id) continue
        beforeById[id] = p
      }

      const beforeSorted = [...before].sort((a, b) => (b?.score || 0) - (a?.score || 0))
      const changedIds = beforeSorted
        .map((p) => getPublicPlayerId(p))
        .filter(Boolean)
        .filter((id) => (afterById[id]?.score ?? beforeById[id]?.score ?? 0) !== (beforeById[id]?.score ?? 0))

      setPhase(PHASES.SCORING)
      setTimeLeft(0)
      setScoreOverlay({
        visible: true,
        hiding: false,
        step: 'before',
        changedIds,
        displayPlayers: beforeSorted,
        beforeById,
        afterById,
      })

      // t=1s: apply score changes (keep current order)
      scoringTimersRef.current.push(
        setTimeout(() => {
          setScoreOverlay((prev) => {
            const next = prev.displayPlayers.map((p) => {
              const id = getPublicPlayerId(p)
              if (!id) return p
              const afterP = prev.afterById[id]
              return afterP ? { ...p, score: afterP.score } : p
            })
            return { ...prev, step: 'updated', displayPlayers: next }
          })
        }, 1000)
      )

      // t=2s: reorder by updated score
      scoringTimersRef.current.push(
        setTimeout(() => {
          setScoreOverlay((prev) => {
            const next = [...prev.displayPlayers].sort((a, b) => (b?.score || 0) - (a?.score || 0))
            return { ...prev, step: 'reordered', displayPlayers: next }
          })
        }, 2000)
      )

      // start fade-out slightly before the end
      scoringTimersRef.current.push(
        setTimeout(() => {
          setScoreOverlay((prev) => (prev.visible ? { ...prev, hiding: true } : prev))
        }, Math.max(0, scoringMs - hideAnimMs))
      )
      scoringTimersRef.current.push(
        setTimeout(() => {
          setScoreOverlay((prev) => (prev.visible ? { ...prev, visible: false, hiding: false, step: 'idle' } : prev))
        }, scoringMs)
      )
    }
    on('SCORE_PHASE', handleScorePhase)

    const handleGameFinished = (data) => {
      refreshMe()
      clearScoringTimers()
      setScoreOverlay((prev) => (prev.visible ? { ...prev, visible: false, hiding: false, step: 'idle' } : prev))
      setPhase(PHASES.FINISHED)
      setLeaderboard((prev) =>
        data.leaderboard && data.leaderboard.length ? data.leaderboard : prev && prev.length ? prev : []
      )
      clearActiveGame()
    }
    on('GAME_FINISHED', handleGameFinished)

    const handleGameState = (data) => {
      setActiveGame(gameId, data.status === 'active' ? 'active' : 'room')

      if (data.status === 'waiting') {
        navigate(`/room/${gameId}`, { replace: true })
        return
      }

      if (data.status === 'finished') {
        // игнорируем, чтобы не сбрасывать итоговый список
        clearActiveGame()
        return
      }

      // active
      setPlayers(data.gamePlayers || [])
      setOrganizerId(data.organizerId || null)
    }
    on('GAME_STATE', handleGameState)

    const handleGameClosed = () => {
      clearActiveGame()
      navigate('/', { replace: true })
    }
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

    const join = () =>
      emit('JOIN_GAME', { gameId, playerId: user.id, player: user, clientSessionId: getClientSessionId() })
    if (socket.connected) join()
    on('connect', join)


    return () => {
      off('GAME_LOADING', handleGameLoading)
      off('NEW_QUESTION', handleNewQuestion)
      off('QUESTION_ENDED', handleQuestionEnded)
      off('SCORE_PHASE', handleScorePhase)
      off('GAME_FINISHED', handleGameFinished)
      off('GAME_STATE', handleGameState)
      off('GAME_CLOSED', handleGameClosed)
      off('GAME_STARTED', handleGameStarted)
      off('SESSION_TAKEN_OVER', handleSessionTakenOver)
      off('ERROR', handleError)
      off('connect', join)
    }
  }, [socket, emit, on, off, gameId, gameIdParam, user, navigate, leaderboard.length, revealDuration, refreshMe])

  const tryReplay = async (kind) => {
    const el = kind === 'video' ? videoRef.current : audioRef.current
    if (!el) return
    try {
      const vol = mediaMuted ? 0 : mediaVolume
      el.muted = !!mediaMuted
      el.volume = Math.min(1, Math.max(0, vol))
      el.pause?.()
      el.currentTime = 0
      await el.play?.()
      setMediaHint((prev) => ({ ...prev, [kind]: false }))
    } catch {
      setMediaHint((prev) => ({ ...prev, [kind]: true }))
    }
  }

  // Apply volume/mute to current media elements.
  useEffect(() => {
    const vol = mediaMuted ? 0 : mediaVolume
    for (const el of [audioRef.current, videoRef.current]) {
      if (!el) continue
      try {
        el.muted = !!mediaMuted
        el.volume = Math.min(1, Math.max(0, vol))
      } catch {
        // ignore
      }
    }
  }, [mediaVolume, mediaMuted, currentQuestion?.id])

  // Try autoplay on each new question (best-effort; some clients block it until user gesture).
  useEffect(() => {
    if (!currentQuestion) return
    if (phase !== PHASES.QUESTION) return

    const videoUrl = normalizeMediaUrl(currentQuestion.video, 'video')
    const audioUrl = normalizeMediaUrl(currentQuestion.audio, 'audio')
    const wantsVideo = videoUrl && !isPlaceholderMedia(videoUrl)
    const wantsAudio = audioUrl && !isPlaceholderMedia(audioUrl)

    const t = setTimeout(() => {
      if (wantsVideo) tryReplay('video')
      else if (wantsAudio) tryReplay('audio')
    }, 0)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, phase])

  // Stop media outside the question phase.
  useEffect(() => {
    if (phase === PHASES.QUESTION) return
    try {
      videoRef.current?.pause?.()
      audioRef.current?.pause?.()
    } catch {
      // ignore
    }
  }, [phase])

  // Моргание правильного ответа
  useEffect(() => {
    if (phase !== PHASES.REVEAL || correctAnswer === null) return
    let flashes = 0
    setFlashCorrect(true)
    const interval = setInterval(() => {
      flashes += 1
      setFlashCorrect((v) => !v)
      if (flashes >= 6) {
        clearInterval(interval)
        setFlashCorrect(true)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [phase, correctAnswer])

  // Автоответ, если время вышло
  useEffect(() => {
    if (phase === PHASES.QUESTION && timeLeft === 0 && !hasSubmitted && currentQuestion) {
      if (currentQuestion.type === 'sequence') {
        if (sequenceOrder.some((v) => v !== null && v !== undefined)) {
          handleSubmitAnswer(sequenceOrder)
        }
      } else if (selectedOption !== null && selectedOption !== undefined) {
        handleSubmitAnswer(selectedOption)
      }
    }
  }, [phase, timeLeft, selectedOption, sequenceOrder, currentQuestion, hasSubmitted])

  const handleAnswerSelect = (answerIndex) => {
    if (phase !== PHASES.QUESTION || hasSubmitted) return
    if (currentQuestion?.type === 'sequence') {
      setSequenceOrder((prev) => {
        const next = [...prev]
        // toggle off
        if (next[answerIndex] !== null && next[answerIndex] !== undefined) {
          next[answerIndex] = null
          return next
        }
        // assign smallest missing positive order
        const used = next.filter((v) => v !== null && v !== undefined)
        let order = 1
        while (used.includes(order)) order += 1
        next[answerIndex] = order
        return next
      })
    } else {
      setSelectedOption(answerIndex)
    }
  }

  const handleSubmitAnswer = (answerPayload) => {
    if (phase !== PHASES.QUESTION || hasSubmitted) return
    setHasSubmitted(true)
    const optionOrder =
      shuffledOptions && shuffledOptions.length
        ? shuffledOptions
        : parseOptions(currentQuestion).map((text, originalIndex) => ({ text, originalIndex }))
    if (currentQuestion?.type === 'sequence') {
      const orderArr = Array.isArray(answerPayload) ? answerPayload : sequenceOrder
      const seq = orderArr
        .map((ord, displayIndex) => ({ ord, displayIndex }))
        .filter((o) => o.ord !== null && o.ord !== undefined)
        .sort((a, b) => a.ord - b.ord)
        .map((o) => optionOrder[o.displayIndex]?.originalIndex)
        .filter((v) => typeof v === 'number')
      setSubmittedSequence(seq)
      emit('SUBMIT_ANSWER', {
        gameId,
        questionId: currentQuestion.id,
        sequence: seq,
        playerId: user.id,
      })
    } else {
      const idx = typeof answerPayload === 'number' ? answerPayload : selectedOption
      const answerIndex = optionOrder[idx]?.originalIndex ?? idx
      emit('SUBMIT_ANSWER', {
        gameId,
        questionId: currentQuestion.id,
        answerIndex,
        playerId: user.id,
      })
    }
  }

  const getOptionLetter = (index) => String.fromCharCode(65 + index)

  if (phase === PHASES.FINISHED) {
    return (
      <div className="w-full max-w-[600px] mx-auto flex-1 min-h-0 flex flex-col overflow-hidden pb-6">
        <div className="text-center pt-2 pb-6">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">Игра завершена!</h1>
        </div>

        <div className="card glass-card shadow-2xl border border-base-300/60 w-full flex-1 min-h-0">
          <div className="card-body min-h-0">
            <div className="scroll-mask flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
              {leaderboard.map((player, index) => (
                <div
                  key={player.player.id}
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    index === 0
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                      : index === 1
                      ? 'bg-gradient-to-r from-gray-500 to-slate-600 text-white'
                      : index === 2
                      ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white'
                      : 'bg-base-300 border border-base-300/70'
                  }`}
                >
                  <div className="text-2xl font-bold w-8">#{index + 1}</div>
                  <div className="avatar">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-content flex items-center justify-center">
                      {player.player.avatarUrl ? (
                        <img src={player.player.avatarUrl} alt={player.player.username} className="rounded-full" />
                      ) : (
                        <span className="text-lg font-bold">{player.player.username?.charAt(0) || 'U'}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">
                      {player.player.username || `${player.player.firstName || ''} ${player.player.lastName || ''}`}
                    </div>
                    <div className="text-sm opacity-90">Общий рейтинг: {player.player.totalScore}</div>
                  </div>
                  <div className="text-2xl font-bold">{player.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center pt-6">
          <button
            className="btn btn-primary btn-lg rounded-full shadow-lg"
            onClick={() => {
              emit('LEAVE_GAME', { gameId, playerId: user.id })
              clearActiveGame()
              navigate('/', { replace: true })
            }}
          >
            На главную
          </button>
        </div>
      </div>
    )
  }

  const baseOptions = parseOptions(currentQuestion)
  const optionOrder =
    shuffledOptions && shuffledOptions.length
      ? shuffledOptions
      : baseOptions.map((text, originalIndex) => ({ text, originalIndex }))
  const options = optionOrder.map((o) => o.text)

  const statusBadge = { text: `Вопрос ${questionIndex + 1} из ${totalQuestions}`, color: 'badge-q3' }
  const difficultyMap = {
    easy: { label: 'ЛЕГКО', color: 'badge-q2' },
    medium: { label: 'СРЕДНЕ', color: 'badge-q3' },
    hard: { label: 'СЛОЖНО', color: 'badge-q4' },
    hardcore: { label: 'ХАРДКОР', color: 'badge-q1' },
  }
  const presetToKey = (preset) => {
    if (preset === 0) return 'easy'
    if (preset === 1) return 'medium'
    if (preset === 2) return 'hard'
    if (preset === 3) return 'hardcore'
    return null
  }
  const difficultyKey = currentQuestion?.difficulty || presetToKey(currentQuestion?.difficultyPreset)
  const difficultyChip = difficultyMap[difficultyKey]
  const myPlayer = players.find((p) => p.player.id === user.id)
  const myAnswer = myPlayer
    ? { isCorrect: myPlayer.isCorrect, answered: myPlayer.currentAnswer !== null && myPlayer.currentAnswer !== undefined }
    : null
  const totalPhaseTime = phase === PHASES.QUESTION ? questionDuration : phase === PHASES.REVEAL ? revealDuration : 0
  const overlayScrollable = (scoreOverlay?.displayPlayers?.length || 0) > 8

  return (
    <div className="w-full max-w-[600px] mx-auto flex-1 min-h-0 flex flex-col items-stretch space-y-6 pb-8 overflow-y-auto">
      {scoreOverlay.visible && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
            scoreOverlay.hiding ? 'opacity-0' : 'opacity-100'
          }`}
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-[600px] card glass-card shadow-2xl border border-base-300/60 overflow-visible">
            <div className="absolute -top-4 left-6 px-4 py-2 rounded-full bg-[#e5d423] text-black text-sm font-bold uppercase pointer-pass">
              Счёт
            </div>
            <div className="card-body pt-12 space-y-4">
              <div className={`grid gap-2 sm:gap-3 ${overlayScrollable ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}`}>
                {scoreOverlay.displayPlayers.map((p, idx) => {
                  const id = getPublicPlayerId(p)
                  if (!id) return null
                  const isSelf = id === user?.id
                  const beforeScore = scoreOverlay.beforeById[id]?.score ?? p.score ?? 0
                  const afterScore = scoreOverlay.afterById[id]?.score ?? p.score ?? 0
                  const delta = afterScore - beforeScore
                  const isChanged = scoreOverlay.changedIds.includes(id)
                  return (
                    <div
                      key={id}
                      ref={(el) => {
                        if (el) scoreRowRefs.current.set(id, el)
                        else scoreRowRefs.current.delete(id)
                      }}
                      className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 rounded-xl bg-base-200 border ${
                        isSelf ? 'border-[#e5d423]' : 'border-[#3a4de6]'
                      } ${!p.isOnline ? 'opacity-60 grayscale' : ''}`}
                    >
                      <span className="w-8 sm:w-10 text-center text-base sm:text-lg font-bold">#{idx + 1}</span>
                      <div className="avatar">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-content flex items-center justify-center">
                          {p.player?.avatarUrl ? (
                            <img src={p.player.avatarUrl} alt={p.player.username} className="rounded-full" />
                          ) : (
                            <span className="text-sm sm:text-base font-bold">{p.player?.username?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base sm:text-lg font-semibold truncate">
                          {p.player?.username || p.player?.firstName || 'Игрок'}
                        </div>
                      </div>
                      <div className="text-right min-w-[84px] sm:min-w-[110px]">
                        <div
                          className={`text-xl sm:text-2xl font-extrabold tabular-nums transition-transform duration-200 ${
                            isChanged && scoreOverlay.step !== 'before' ? 'text-green-300' : 'text-[#e5d423]'
                          } ${isChanged && scoreOverlay.step === 'updated' ? 'scale-110' : ''}`}
                        >
                          {p.score || 0}
                        </div>
                        <div className="h-5 text-xs sm:text-sm font-semibold tabular-nums text-green-300">
                          {isChanged && scoreOverlay.step !== 'before' && delta > 0 ? `+${delta}` : '\u00A0'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {!currentQuestion && phase !== PHASES.LOADING && phase !== PHASES.FINISHED && (
        <div className="card glass-card shadow-2xl border border-base-300/60 w-full max-w-[600px] mx-auto mt-3">
          <div className="card-body text-center py-16">
            <div className="text-2xl font-black">Вопрос загружается</div>
            <div className="opacity-70 mt-2">Подождите пару секунд...</div>
          </div>
        </div>
      )}
      {currentQuestion && phase !== PHASES.LOADING && (
        <div className="card glass-card shadow-2xl border border-base-300/60 w-full max-w-[600px] mx-auto relative overflow-visible mt-3">
	          <div className="absolute -top-3 left-4 flex flex-wrap gap-2 pointer-pass">
	            <div className="px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
	              {statusBadge.text}
	            </div>
	            {difficultyChip && (
	              <div className={`badge gap-2 p-3 rounded-xl font-bold ${difficultyChip.color}`}>{difficultyChip.label}</div>
	            )}
	          </div>
	          <div className="card-body pt-8">
            {totalPhaseTime > 0 && (
              <div className="relative mb-2 h-2 rounded-full bg-base-300 overflow-hidden">
                <div
                  key={barKey}
                  className="absolute inset-0 rounded-full progress-bar-fill"
                  style={{ animationDuration: `${totalPhaseTime}s` }}
                />
              </div>
            )}

	            <div className="mt-4 space-y-3">
	              {(() => {
	                const pictureUrl = normalizeMediaUrl(currentQuestion.picture, 'pictures')
	                const videoUrl = normalizeMediaUrl(currentQuestion.video, 'video')
	                const audioUrl = normalizeMediaUrl(currentQuestion.audio, 'audio')

	                return (
	                  <div className="space-y-3">
	                    {pictureUrl && !isPlaceholderMedia(pictureUrl) && (
	                      <img
	                        src={pictureUrl}
	                        alt="question media"
	                        className="w-full max-h-[320px] object-cover rounded-xl border border-base-300/60"
	                        loading="lazy"
	                        decoding="async"
	                      />
	                    )}

	                    {videoUrl && !isPlaceholderMedia(videoUrl) && (
	                      <div className="relative">
	                        <div
	                          role="button"
	                          tabIndex={0}
	                          className="cursor-pointer"
	                          onClick={() => tryReplay('video')}
	                          onKeyDown={(e) => {
	                            if (e.key === 'Enter' || e.key === ' ') tryReplay('video')
	                          }}
	                        >
	                          <video
	                            ref={videoRef}
	                            src={videoUrl}
	                            playsInline
	                            className="w-full max-h-[360px] rounded-xl border border-base-300/60 bg-black"
	                          />
	                        </div>
	                        <div
	                          className="absolute left-3 bottom-3 px-3 py-2 rounded-xl bg-black/60 text-white text-sm flex items-center gap-3 pointer-events-auto"
	                          onPointerDown={(e) => e.stopPropagation()}
	                          onClick={(e) => e.stopPropagation()}
	                        >
	                          <button
	                            type="button"
	                            className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center"
	                            onClick={() => setMediaMuted((v) => !v)}
	                            title={mediaMuted ? 'Включить звук' : 'Выключить звук'}
	                          >
	                            {mediaMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
	                          </button>
	                          <input
	                            type="range"
	                            min="0"
	                            max="100"
	                            value={Math.round((mediaMuted ? 0 : mediaVolume) * 100)}
	                            onChange={(e) => {
	                              const next = Number(e.target.value) / 100
	                              setMediaVolume(next)
	                              if (next > 0 && mediaMuted) setMediaMuted(false)
	                            }}
	                            className="w-28"
	                          />
	                        </div>
	                        <div className="absolute right-3 bottom-3 px-3 py-2 rounded-xl bg-black/60 text-white text-sm flex items-center gap-2 pointer-events-none">
	                          <RotateCcw size={16} />
	                          {mediaHint.video ? 'Нажми, чтобы воспроизвести' : 'Нажми, чтобы повторить'}
	                        </div>
	                      </div>
	                    )}

	                    {audioUrl && !isPlaceholderMedia(audioUrl) && (
	                      <div className="relative">
	                        <audio ref={audioRef} src={audioUrl} preload="auto" />
	                        <button
	                          type="button"
	                          className="w-full px-4 py-3 rounded-xl bg-base-200 border border-base-300/60 text-left font-semibold flex items-center justify-between"
	                          onClick={() => tryReplay('audio')}
	                        >
	                          <span className="flex items-center gap-2">
	                            <Volume2 size={18} />
	                            {mediaHint.audio ? 'Нажми, чтобы воспроизвести звук' : 'Нажми, чтобы повторить звук'}
	                          </span>
	                          <RotateCcw size={18} />
	                        </button>
	                        <div className="mt-2 flex items-center gap-3">
	                          <button
	                            type="button"
	                            className="w-10 h-10 rounded-xl bg-base-200 border border-base-300/60 flex items-center justify-center"
	                            onClick={() => setMediaMuted((v) => !v)}
	                            title={mediaMuted ? 'Включить звук' : 'Выключить звук'}
	                          >
	                            {mediaMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
	                          </button>
	                          <input
	                            type="range"
	                            min="0"
	                            max="100"
	                            value={Math.round((mediaMuted ? 0 : mediaVolume) * 100)}
	                            onChange={(e) => {
	                              const next = Number(e.target.value) / 100
	                              setMediaVolume(next)
	                              if (next > 0 && mediaMuted) setMediaMuted(false)
	                            }}
	                            className="flex-1"
	                          />
	                          <div className="text-xs opacity-70 w-10 text-right">{Math.round((mediaMuted ? 0 : mediaVolume) * 100)}%</div>
	                        </div>
	                      </div>
	                    )}
	                  </div>
	                )
	              })()}
	              <h2 className="text-2xl font-bold leading-snug break-words whitespace-pre-line">{currentQuestion.text}</h2>
	              <div className="grid gap-3 mt-4">
	                {optionOrder.map((opt, idx) => {
	                  const originalIndex = opt.originalIndex
	                  const isSelected =
                    currentQuestion?.type === 'sequence'
                      ? sequenceOrder[idx] !== null && sequenceOrder[idx] !== undefined
                      : selectedOption === idx
                  let isCorrectOpt = correctAnswer === originalIndex
                  let isWrongSelection = phase === PHASES.REVEAL && isSelected && !isCorrectOpt
                  if (phase === PHASES.REVEAL && currentQuestion?.type === 'sequence' && correctSequence) {
                    const cs = Array.isArray(correctSequence) ? correctSequence : []
                    const userSeq = Array.isArray(submittedSequence) ? submittedSequence : []
                    const userPos = userSeq.indexOf(originalIndex)
                    const correctPos = cs.indexOf(originalIndex)
                    if (userPos === correctPos && userPos !== -1) {
                      isCorrectOpt = true
                      isWrongSelection = false
                    } else {
                      isCorrectOpt = false
                      isWrongSelection = userPos !== -1
                    }
                  }
                  const base =
                    phase === PHASES.REVEAL && isCorrectOpt
                      ? `${flashCorrect ? 'bg-green-600' : 'bg-green-700'} text-white`
                      : isWrongSelection
                      ? 'bg-red-500 text-white'
                      : isSelected
                      ? 'bg-primary text-white'
                      : 'bg-base-200 text-white'

                  return (
                    <button
                      key={idx}
                      className={`relative w-full text-left px-4 py-3 rounded-xl border border-base-300/50 transition-colors ${base}`}
                      onClick={() => handleAnswerSelect(idx)}
                      disabled={phase !== PHASES.QUESTION || hasSubmitted}
                    >
                      <span className="font-semibold mr-2">{getOptionLetter(idx)}.</span>
                      <span className="break-words">{opt.text}</span>
                      {currentQuestion?.type === 'sequence' && isSelected && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-base-100 text-primary font-bold flex items-center justify-center border border-primary">
                          {sequenceOrder[idx]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentQuestion && (
        <div className="w-full max-w-[600px] mx-auto">
          {(() => {
            const base = 'w-full h-14 text-base font-semibold rounded-xl flex items-center justify-center transition-colors'
            const isSequence = currentQuestion?.type === 'sequence'
            const filledCount = sequenceOrder.filter((v) => v !== null && v !== undefined).length
            const selectionComplete = isSequence ? options.length > 0 && filledCount === options.length : selectedOption !== null
            const canSubmit = phase === PHASES.QUESTION && !hasSubmitted && selectionComplete
            const styles = hasSubmitted
              ? { backgroundColor: '#22c55e', borderColor: '#22c55e' } // green
              : selectionComplete
              ? { backgroundColor: '#2563eb', borderColor: '#2563eb' } // blue
              : { backgroundColor: '#4b5563', borderColor: '#4b5563' } // gray
            const buttonLabel = hasSubmitted
              ? 'Подтверждено'
              : selectionComplete
              ? 'Подтвердить'
              : 'Сделай выбор'
            return (
              <button
                className={base}
                disabled={!canSubmit}
                style={styles}
                onClick={() =>
                  !canSubmit
                    ? null
                    : currentQuestion?.type === 'sequence'
                    ? handleSubmitAnswer(sequenceOrder)
                    : handleSubmitAnswer(selectedOption)
                }
              >
                {buttonLabel}
              </button>
            )
          })()}
        </div>
      )}

      {features?.playersListInGame && players.length > 0 && phase !== PHASES.FINISHED && (
        <div className="card glass-card shadow-xl border border-base-300/60 w-full max-w-[600px] mx-auto relative overflow-visible">
          <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
            Игроки: {players.length}
          </div>
          <div className="card-body pt-8 space-y-3">
            <div className="grid gap-2 pr-1 max-h-[360px] overflow-y-auto">
              {[...players]
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, idx) => {
                  const isSelf = p.player.id === user.id
                  const answered = p.currentAnswer !== null && p.currentAnswer !== undefined
                  const isHost = organizerId && p.player.id === organizerId
                  return (
                    <div
                      key={p.player.id}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg bg-base-200 border ${
                        isSelf ? 'border-[#e5d423]' : 'border-[#3a4de6]'
                      } ${!p.isOnline ? 'opacity-60 grayscale' : ''}`}
                    >
                      <span className="w-6 text-center text-sm font-semibold">#{idx + 1}</span>
                      <div className="relative">
                        <div className="avatar">
                          <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
                            {p.player.avatarUrl ? (
                              <img src={p.player.avatarUrl} alt={p.player.username} className="rounded-full" />
                            ) : (
                              <span className="text-sm font-bold">{p.player.username?.charAt(0) || 'U'}</span>
                            )}
                          </div>
                        </div>
                        {isHost && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs text-[#e5d423]">★</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">
                          {p.player.username || p.player.firstName || 'Игрок'}
                        </div>
                        <div className="text-sm flex items-center gap-1 text-[#e5d423]">
                          <Trophy size={14} />
                          <span className="font-bold">{p.score || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <CheckCircle2 size={20} className={answered ? 'text-green-400' : 'text-gray-500'} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </div>
  )
}

export default Game
