import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { gameAPI } from '../utils/api'
import { Trophy, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { buildTelegramMiniAppUrl } from '../utils/telegram'

const parseOptions = (question) => {
  if (!question) return []
  if (Array.isArray(question.options)) return question.options
  try {
    return JSON.parse(question.options || '[]')
  } catch {
    return []
  }
}

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

const difficultyMeta = {
  easy: { label: 'ЛЕГКО', badge: 'badge-q2' },
  medium: { label: 'СРЕДНЕ', badge: 'badge-q3' },
  hard: { label: 'СЛОЖНО', badge: 'badge-q4' },
  hardcore: { label: 'ХАРДКОР', badge: 'badge-q1' },
  random: { label: 'СЛУЧАЙНО', badge: 'badge-q6' },
}

const Spectate = () => {
  const { spectateToken } = useParams()
  const { emit, isConnected, on, off } = useSocket()

  const PHASES = {
    WAITING: 'waiting',
    QUESTION: 'question',
    REVEAL: 'reveal',
    SCORING: 'scoring',
    FINISHED: 'finished',
  }

  const [game, setGame] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [phase, setPhase] = useState(PHASES.WAITING)
  const [phaseDuration, setPhaseDuration] = useState(0)
  const [revealDuration, setRevealDuration] = useState(3)
  const [barKey, setBarKey] = useState(0)
  const [players, setPlayers] = useState([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [gameStatus, setGameStatus] = useState('waiting') // waiting, active, finished
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closedView, setClosedView] = useState(false)
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const [mediaHint, setMediaHint] = useState({ audio: false, video: false })
  const [mediaVolume, setMediaVolume] = useState(0.9) // 0..1
  const [mediaMuted, setMediaMuted] = useState(false)
  const scoringTimersRef = useRef([])
  const revealDurationRef = useRef(3)
  const freezePlayersRef = useRef(false)
  const pendingPlayersRef = useRef(null)
  const [scoringStep, setScoringStep] = useState('idle') // idle | before | updated | reordered
  const [scoreDeltas, setScoreDeltas] = useState({})
  const [playersView, setPlayersView] = useState([])

  const clearScoringTimers = () => {
    for (const t of scoringTimersRef.current) clearTimeout(t)
    scoringTimersRef.current = []
    freezePlayersRef.current = false
    pendingPlayersRef.current = null
  }

  const getPublicPlayerId = (p) => p?.playerId ?? p?.player?.id ?? null

  useEffect(() => {
    revealDurationRef.current = revealDuration
  }, [revealDuration])

  useEffect(() => {
    return () => {
      clearScoringTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadGame = async () => {
    try {
      setLoading(true)
      setError('')
      setClosedView(false)

      const token = String(spectateToken || '').toUpperCase()
      const response = await gameAPI.getSpectate(token)
      setGame(response.data)
      setPlayers(response.data.gamePlayers || [])
      setGameStatus(response.data.status || 'waiting')
      setTotalQuestions(response.data.gameQuestions?.length || 0)

      // Если игра уже активна — покажем текущий вопрос (без подсветки правильного ответа)
      if (response.data.status === 'active' && response.data.gameQuestions && response.data.gameQuestions.length > 0) {
        const idx = response.data.currentQuestion || 0
        const currentQ = response.data.gameQuestions[idx]
        if (currentQ) {
          setCurrentQuestion(currentQ.question)
          setQuestionIndex(idx)
          const qd = 15
          setPhase(PHASES.QUESTION)
          setPhaseDuration(qd)
          setTimeLeft(qd)
          setBarKey(Date.now())
          setCorrectAnswer(null)
        }
      }

      if (response.data.status === 'finished') {
        setPhase(PHASES.FINISHED)
        setCurrentQuestion(null)
        setTimeLeft(0)
        setPhaseDuration(0)
      }
    } catch (err) {
      console.error('Spectate load error', err)
      setError('Комната для просмотра не найдена или удалена')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGame()
  }, [spectateToken])

  // Подписка зрителя на сокеты
  useEffect(() => {
    if (!isConnected || !spectateToken) return

    const token = String(spectateToken || '').toUpperCase()

 	    const handleNewQuestion = (data) => {
 	      clearScoringTimers()
 	      setCurrentQuestion(data.question)
 	      setQuestionIndex(data.questionIndex)
 	      setTotalQuestions(data.totalQuestions || 0)
		      setCorrectAnswer(null)
		      setMediaHint({ audio: false, video: false })
		      const qd = Math.max(1, Math.round((data.questionTimeMs || 15000) / 1000))
		      const rd = Math.max(1, Math.round((data.revealTimeMs || 3000) / 1000))
		      setRevealDuration(rd)
		      setPhase(PHASES.QUESTION)
		      setPhaseDuration(qd)
		      setTimeLeft(qd)
		      setBarKey(Date.now())
		      setGameStatus('active')
		      setScoringStep('idle')
		      setScoreDeltas({})
		    }

    const handleQuestionEnded = (data) => {
      clearScoringTimers()
      if (data && typeof data.correctAnswer === 'number') {
        setCorrectAnswer(data.correctAnswer)
      }
      setPhase(PHASES.REVEAL)
      setPhaseDuration(revealDurationRef.current)
      setTimeLeft(revealDurationRef.current)
      setBarKey(Date.now())
    }

    const handleGameState = (data) => {
      const nextPlayers = data.gamePlayers || []
      if (freezePlayersRef.current) {
        pendingPlayersRef.current = nextPlayers
      } else {
        setPlayers(nextPlayers)
      }
      setGameStatus(data.status || 'waiting')
      if (data.status === 'waiting') {
        setPhase(PHASES.WAITING)
        setTimeLeft(0)
        setPhaseDuration(0)
      }
    }

    const handleGameStarted = () => setGameStatus('active')

	    const handleScorePhase = (data) => {
	      clearScoringTimers()
	      freezePlayersRef.current = true

      const before = Array.isArray(data?.beforePlayers) ? data.beforePlayers : []
      const after = Array.isArray(data?.afterPlayers) ? data.afterPlayers : []
	      const scoringSec = Math.max(1, Math.round((data?.scoringTimeMs || 5000) / 1000))
	      const scoringMs = scoringSec * 1000

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
      const deltas = {}
      for (const p of beforeSorted) {
        const id = getPublicPlayerId(p)
        if (!id) continue
        const beforeScore = beforeById[id]?.score ?? 0
        const afterScore = afterById[id]?.score ?? beforeScore
        const d = afterScore - beforeScore
        if (d) deltas[id] = d
      }

      setPhase(PHASES.SCORING)
      setPhaseDuration(scoringSec)
      setTimeLeft(scoringSec)
      setBarKey(Date.now())

      setScoringStep('before')
      setScoreDeltas(deltas)
      setPlayers(before)
      setPlayersView(beforeSorted)

      // t=1s: apply score changes (keep current order)
      scoringTimersRef.current.push(
        setTimeout(() => {
          freezePlayersRef.current = false
          if (pendingPlayersRef.current) {
            setPlayers(pendingPlayersRef.current)
            pendingPlayersRef.current = null
          }
          setScoringStep('updated')
          setPlayers(after)
          setPlayersView((prevPlayers) => {
            const next = prevPlayers.map((p) => {
              const id = getPublicPlayerId(p)
              if (!id) return p
              const afterP = afterById[id]
              return afterP ? { ...p, score: afterP.score } : p
            })
            return next
          })
        }, 1000)
      )

      // t=2s: reorder by updated score
      scoringTimersRef.current.push(
        setTimeout(() => {
          setScoringStep('reordered')
          setPlayersView((prevPlayers) => [...prevPlayers].sort((a, b) => (b?.score || 0) - (a?.score || 0)))
        }, 2000)
      )

      // end scoring: clear temporary deltas
      scoringTimersRef.current.push(
        setTimeout(() => {
          setScoringStep('idle')
          setScoreDeltas({})
          setPlayersView([])
        }, scoringMs)
      )
    }

    const handleGameFinished = (data) => {
      clearScoringTimers()
      setGameStatus('finished')
      setTimeLeft(0)
      setCurrentQuestion(null)
      setCorrectAnswer(null)
      setPlayers(data.leaderboard || [])
      setPhase(PHASES.FINISHED)
      setPhaseDuration(0)
      setScoringStep('idle')
      setScoreDeltas({})
      setPlayersView([])
    }

    const handleGameClosed = () => {
      clearScoringTimers()
      setClosedView(true)
      setError('Комната не найдена')
      setGame(null)
      setPlayers([])
      setCurrentQuestion(null)
      setTimeLeft(0)
      setGameStatus('waiting')
      setPhase(PHASES.WAITING)
      setPhaseDuration(0)
      setScoringStep('idle')
      setScoreDeltas({})
      setPlayersView([])
    }

	    on('NEW_QUESTION', handleNewQuestion)
	    on('QUESTION_ENDED', handleQuestionEnded)
	    on('SCORE_PHASE', handleScorePhase)
    on('GAME_STATE', handleGameState)
    on('GAME_STARTED', handleGameStarted)
    on('GAME_FINISHED', handleGameFinished)
    on('GAME_CLOSED', handleGameClosed)

    // backend emits initial state right away; subscribe first, then join to avoid missing NEW_QUESTION.
    emit('JOIN_SPECTATOR', { spectateToken: token })

    return () => {
      off('NEW_QUESTION', handleNewQuestion)
      off('QUESTION_ENDED', handleQuestionEnded)
      off('SCORE_PHASE', handleScorePhase)
      off('GAME_STATE', handleGameState)
      off('GAME_STARTED', handleGameStarted)
      off('GAME_FINISHED', handleGameFinished)
      off('GAME_CLOSED', handleGameClosed)
    }
  }, [emit, isConnected, spectateToken, on, off])

  // Таймер обратного отсчёта для зрителя (локальный)
  useEffect(() => {
    if (timeLeft > 0 && phase !== PHASES.WAITING && phase !== PHASES.FINISHED) {
      const timer = setTimeout(() => setTimeLeft((v) => v - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft, phase])

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

  // Best-effort autoplay when the question changes.
  useEffect(() => {
    if (!currentQuestion) return
    if (gameStatus !== 'active') return

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
  }, [currentQuestion?.id, gameStatus])

  useEffect(() => {
    if (gameStatus === 'active') return
    try {
      videoRef.current?.pause?.()
      audioRef.current?.pause?.()
    } catch {
      // ignore
    }
  }, [gameStatus])

  const optionOrder = useMemo(() => {
    const opts = parseOptions(currentQuestion)
    const order = Array.isArray(currentQuestion?.optionOrder) ? currentQuestion.optionOrder : null
    if (order && order.length === opts.length) {
      return opts.map((text, displayIndex) => ({ text, originalIndex: order[displayIndex] ?? displayIndex }))
    }
    return opts.map((text, originalIndex) => ({ text, originalIndex }))
  }, [currentQuestion])
  const playersSorted = useMemo(
    () => (Array.isArray(players) ? [...players].sort((a, b) => (b?.score || 0) - (a?.score || 0)) : []),
    [players]
  )

  const renderPlayers = useMemo(() => {
    if (scoringStep !== 'idle' && Array.isArray(playersView) && playersView.length) return playersView
    return playersSorted
  }, [playersSorted, scoringStep, playersView])

  const playerRowRefs = useRef(new Map())
  const prevRowTops = useRef(new Map())

  useLayoutEffect(() => {
    const nextTops = new Map()
    for (const [id, el] of playerRowRefs.current.entries()) {
      if (!el) continue
      nextTops.set(id, el.getBoundingClientRect().top)
    }

    for (const [id, el] of playerRowRefs.current.entries()) {
      if (!el) continue
      const prevTop = prevRowTops.current.get(id)
      const nextTop = nextTops.get(id)
      if (prevTop === undefined || nextTop === undefined) continue
      const delta = prevTop - nextTop
      if (!delta) continue

      el.style.transition = 'transform 0s'
      el.style.transform = `translateY(${delta}px)`
      requestAnimationFrame(() => {
        if (!playerRowRefs.current.get(id)) return
        el.style.transition = 'transform 850ms ease'
        el.style.transform = ''
      })
    }

    prevRowTops.current = nextTops
  }, [renderPlayers.map((p) => `${getPublicPlayerId(p) ?? 'x'}:${p?.score ?? 0}`).join('|')])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center space-y-4">
          <span className="loading loading-spinner loading-lg"></span>
          <p>Загрузка режима зрителя...</p>
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="card bg-base-200 shadow-xl max-w-md w-full">
          <div className="card-body space-y-4 text-center">
            <h2 className="text-xl font-bold">Комната не найдена</h2>
            {closedView ? (
              <p className="opacity-70">Игра окончена. Можете закрыть вкладку.</p>
            ) : (
              <>
                <p className="opacity-70">{error || 'Попробуй обновить ссылку или создай новую комнату.'}</p>
                <a className="btn btn-primary" href="/">
                  На главную
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const questionChipText =
    totalQuestions > 0
      ? `Вопрос ${questionIndex + 1} из ${totalQuestions}`
      : questionIndex >= 0 && gameStatus === 'active'
      ? `Вопрос ${questionIndex + 1}`
      : null
  const difficulty = game?.difficulty
  const difficultyChip = difficulty
    ? difficultyMeta[difficulty] || { label: String(difficulty).toUpperCase(), badge: 'badge-q6' }
    : null
  const presetToKey = (preset) => {
    if (preset === 0) return 'easy'
    if (preset === 1) return 'medium'
    if (preset === 2) return 'hard'
    if (preset === 3) return 'hardcore'
    return null
  }
  const questionDifficultyKey = currentQuestion?.difficulty || presetToKey(currentQuestion?.difficultyPreset)
  const questionDifficultyChip = questionDifficultyKey
    ? difficultyMeta[questionDifficultyKey] || { label: String(questionDifficultyKey).toUpperCase(), badge: 'badge-q6' }
    : null
  const primaryChipText = questionChipText

  const joinUrl = game?.id ? `${window.location.origin}/${game.id}` : ''
  const telegramJoinUrl = game?.id ? buildTelegramMiniAppUrl(game.id) : ''
  const qrValue = telegramJoinUrl || joinUrl
  const showDelta = scoringStep !== 'idle' && scoringStep !== 'before'
  const isFinished = gameStatus === 'finished'

  return (
    <div className="w-full h-full px-6 lg:px-10 pt-10 pb-10">
      <div className="w-full h-full">
        <div className="flex flex-col lg:flex-row gap-8 items-stretch h-full">
          <div
            className={`w-full ${isFinished ? 'lg:basis-full lg:max-w-full' : 'lg:basis-[70%] lg:max-w-[70%]'} lg:order-2 flex flex-col min-h-0`}
          >
            <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible flex-1 h-full min-h-0">
              <div className="absolute -top-3 left-4 flex flex-wrap gap-2 pointer-pass">
                <div className="px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass max-w-[70vw] lg:max-w-[820px] truncate">
                  {game?.topic || game?.topicName || 'Тема'}
                </div>
                {difficultyChip ? (
                  <div className={`badge gap-2 p-3 rounded-xl font-bold ${difficultyChip.badge}`}>{difficultyChip.label}</div>
                ) : null}
              </div>

              <div className="card-body pt-10 flex flex-col h-full min-h-0">
                <div
                  className="card shadow-xl border border-base-300/60 relative overflow-visible w-full"
                  style={{ background: '#11192a' }}
                >
                  {gameStatus === 'active' ? (
                    <div className="absolute -top-3 left-4 flex flex-wrap gap-2 pointer-pass">
                      {primaryChipText ? (
                        <div className="px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
                          {primaryChipText}
                        </div>
                      ) : null}
                      {questionDifficultyChip ? (
                        <div className={`badge gap-2 p-3 rounded-xl font-bold ${questionDifficultyChip.badge}`}>
                          {questionDifficultyChip.label}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="card-body pt-10 flex flex-col min-h-0">
                  {isFinished ? (
                    <>
                      <div className="text-center pt-2 pb-6">
                        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                        <h1 className="text-4xl lg:text-5xl font-black mb-2">Игра завершена!</h1>
                        <div className="opacity-70 text-lg">Можно закрыть вкладку</div>
                      </div>

                      <div className="scroll-mask overflow-y-auto space-y-3 pr-1 max-h-[70vh]">
                        {playersSorted.map((player, index) => (
                          <div
                            key={player?.player?.id ?? player?.playerId ?? index}
                            className={`flex items-center gap-4 p-4 rounded-lg ${
                              index === 0
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                                : index === 1
                                ? 'bg-gradient-to-r from-gray-500 to-slate-600 text-white'
                                : index === 2
                                ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white'
                                : 'bg-[#0f1626] border border-base-300/70'
                            } ${player?.isOnline === false ? 'opacity-70 grayscale' : ''}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-black/20 border border-white/10 flex items-center justify-center font-black text-lg tabular-nums">
                              {index + 1}
                            </div>
                            <div className="avatar">
                              <div className="w-12 h-12 rounded-full bg-primary text-primary-content flex items-center justify-center overflow-hidden">
                                {player?.player?.avatarUrl ? (
                                  <img src={player.player.avatarUrl} alt={player.player.username} className="rounded-full" />
                                ) : (
                                  <span className="text-lg font-bold">{player?.player?.username?.charAt(0) || 'U'}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lg truncate">
                                {player?.player?.username ||
                                  `${player?.player?.firstName || ''} ${player?.player?.lastName || ''}`.trim() ||
                                  'User'}
                              </div>
                              <div className="text-sm opacity-90">Общий рейтинг: {player?.player?.totalScore ?? 0}</div>
                            </div>
                            <div className="text-2xl font-black tabular-nums">{player?.score ?? 0}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : gameStatus === 'active' ? (
                    currentQuestion ? (
                    <>
                      {phaseDuration > 0 ? (
                        <div className="relative mb-3 h-2 rounded-full bg-base-300 overflow-hidden">
                          <div
                            key={barKey}
                            className="absolute inset-0 rounded-full progress-bar-fill"
                            style={{ animationDuration: `${phaseDuration}s` }}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-4">
                        {(() => {
                          const pictureUrl = normalizeMediaUrl(currentQuestion.picture, 'pictures')
                          const videoUrl = normalizeMediaUrl(currentQuestion.video, 'video')
                          const audioUrl = normalizeMediaUrl(currentQuestion.audio, 'audio')

                          return (
                            <>
                              {pictureUrl && !isPlaceholderMedia(pictureUrl) && (
                                <img
                                  src={pictureUrl}
                                  alt="question media"
                                  className="w-full max-h-[420px] object-cover rounded-xl border border-base-300/60"
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
                                      className="w-full max-h-[460px] rounded-xl border border-base-300/60 bg-black"
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
                                <div>
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
                            </>
                          )
                        })()}
                      </div>

                      <h2 className="text-3xl font-black leading-snug break-words whitespace-pre-line mt-6">
                        {currentQuestion.text}
                      </h2>

                      <div className="grid gap-4 mt-8">
                        {optionOrder.map((opt, index) => {
                          const isCorrect = correctAnswer !== null && correctAnswer === opt.originalIndex
                          const isDimmed = correctAnswer !== null && !isCorrect
                          const letter = String.fromCharCode(65 + index)

                          const base =
                            correctAnswer === null
                              ? 'bg-base-200 border-base-300/60 text-white shadow-md'
                              : isCorrect
                              ? 'bg-green-700 border-green-500 text-white shadow-md'
                              : 'bg-base-200 border-base-300/60 text-white shadow-sm'

                          return (
                            <div
                              key={index}
                              className={`w-full px-7 py-5 rounded-2xl border transition-colors ${base} ${
                                isDimmed ? 'opacity-70' : ''
                              }`}
                            >
                              <div className="flex items-center justify-center gap-4">
                                <span className="w-10 h-10 rounded-full bg-black/20 border border-white/10 flex items-center justify-center font-black text-lg">
                                  {letter}
                                </span>
                                <span className="text-xl font-semibold">{opt.text}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-3xl font-black">Вопрос загружается</div>
                      <div className="opacity-70 mt-2">Подождите пару секунд...</div>
                    </div>
                  )
                  ) : (
                    <div className="text-center py-16">
                      {gameStatus === 'waiting' && joinUrl ? (
                        <div className="max-w-lg mx-auto">
                          <div className="text-3xl font-black">Ожидание игроков</div>
                          <div className="opacity-70 mt-2 text-lg">Сканируй QR-код, чтобы подключиться к комнате</div>

                          <div className="mt-8 flex justify-center">
                            <div className="p-4 rounded-2xl bg-white shadow-xl">
                              <QRCodeSVG value={qrValue} size={320} includeMargin />
                            </div>
                          </div>

                          <div className="mt-6 text-3xl font-black">
                            Код комнаты: <span className="tracking-widest">{game?.id}</span>
                          </div>
                          <div className="mt-2 text-2xl font-semibold opacity-80 break-all">{telegramJoinUrl || joinUrl}</div>
                        </div>
                      ) : (
                        <>
                          <div className="text-3xl font-black">Игра скоро начнётся</div>
                          <div className="opacity-70 mt-2">Ожидаем участников...</div>
                        </>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>
              </div>
          </div>

          {!isFinished ? (
          <div className="w-full lg:basis-[30%] lg:max-w-[30%] lg:order-1 flex flex-col min-h-0">
            <div className="card glass-card shadow-xl border border-base-300/60 w-full relative overflow-visible flex-1 h-full min-h-0">
              <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
                Игроки: {renderPlayers.length}
              </div>
              <div className="card-body pt-8 flex flex-col min-h-0">
                <div className="scroll-mask grid gap-2 pr-1 flex-1 min-h-0 overflow-y-auto">
                  {renderPlayers.map((p, idx) => {
                    const id = getPublicPlayerId(p)
                    const delta = id ? scoreDeltas[id] : 0
                    return (
                    <div
                      key={p?.player?.id ?? p?.playerId ?? idx}
                      ref={(el) => {
                        const rid = String(getPublicPlayerId(p) ?? idx)
                        if (el) playerRowRefs.current.set(rid, el)
                        else playerRowRefs.current.delete(rid)
                      }}
                      className={`flex items-center gap-3 px-4 py-4 rounded-xl bg-base-200 border border-[#3a4de6] will-change-transform ${
                        p?.isOnline === false ? 'opacity-60 grayscale' : ''
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-black/20 border border-white/10 flex items-center justify-center text-sm font-bold tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="avatar">
                        <div className="w-11 h-11 rounded-full bg-primary text-primary-content flex items-center justify-center overflow-hidden">
                          {p?.player?.avatarUrl ? (
                            <img src={p.player.avatarUrl} alt={p?.player?.username || 'player'} className="rounded-full" />
                          ) : (
                            <span className="text-sm font-bold">{p?.player?.username?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-base">
                          {p?.player?.username || `${p?.player?.firstName || ''} ${p?.player?.lastName || ''}`.trim() || 'User'}
                        </div>
                      </div>
                      <div className="text-right min-w-[84px]">
                        <div className="font-black tabular-nums text-lg">{p?.score ?? 0}</div>
                        <div className="h-4 text-xs font-semibold tabular-nums text-green-300">
                          {showDelta && delta > 0 ? `+${delta}` : '\u00A0'}
                        </div>
                      </div>
                    </div>
                    )
                  })}

                  {renderPlayers.length === 0 && <div className="text-center py-8 opacity-50">Нет игроков</div>}
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default Spectate
