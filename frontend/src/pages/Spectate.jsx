import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { gameAPI } from '../utils/api'
import { Trophy, Volume2, VolumeX, RotateCcw } from 'lucide-react'

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
  random: { label: 'РАНДОМ', badge: 'badge-q6' },
}

const Spectate = () => {
  const { spectateToken } = useParams()
  const { emit, isConnected, on, off } = useSocket()

  const [game, setGame] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [players, setPlayers] = useState([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [gameStatus, setGameStatus] = useState('waiting') // waiting, active, finished
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const [mediaHint, setMediaHint] = useState({ audio: false, video: false })
  const [mediaVolume, setMediaVolume] = useState(0.9) // 0..1
  const [mediaMuted, setMediaMuted] = useState(false)

  const loadGame = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await gameAPI.getSpectate(spectateToken)
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
          setTimeLeft(15)
          setCorrectAnswer(null)
        }
      }

      if (response.data.status === 'finished') {
        setCurrentQuestion(null)
        setTimeLeft(0)
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

    // backend сам найдёт игру по токену/коду комнаты и подключит зрителя к нужной комнате
    emit('JOIN_SPECTATOR', { spectateToken })

	    const handleNewQuestion = (data) => {
	      setCurrentQuestion(data.question)
	      setQuestionIndex(data.questionIndex)
	      setTotalQuestions(data.totalQuestions || 0)
	      setCorrectAnswer(null)
	      setMediaHint({ audio: false, video: false })
	      setTimeLeft(15)
	      setGameStatus('active')
	    }

    const handleQuestionEnded = (data) => {
      setTimeLeft(0)
      if (data && typeof data.correctAnswer === 'number') {
        setCorrectAnswer(data.correctAnswer)
      }
    }

    const handleGameState = (data) => {
      setPlayers(data.gamePlayers || [])
      setGameStatus(data.status || 'waiting')
    }

    const handleGameStarted = () => setGameStatus('active')

    const handleGameFinished = (data) => {
      setGameStatus('finished')
      setTimeLeft(0)
      setCurrentQuestion(null)
      setCorrectAnswer(null)
      setPlayers(data.leaderboard || [])
    }

    const handleGameClosed = () => {
      setError('Комната закрыта')
      setGame(null)
      setPlayers([])
      setCurrentQuestion(null)
      setTimeLeft(0)
      setGameStatus('waiting')
    }

    on('NEW_QUESTION', handleNewQuestion)
    on('QUESTION_ENDED', handleQuestionEnded)
    on('GAME_STATE', handleGameState)
    on('GAME_STARTED', handleGameStarted)
    on('GAME_FINISHED', handleGameFinished)
    on('GAME_CLOSED', handleGameClosed)

    return () => {
      off('NEW_QUESTION', handleNewQuestion)
      off('QUESTION_ENDED', handleQuestionEnded)
      off('GAME_STATE', handleGameState)
      off('GAME_STARTED', handleGameStarted)
      off('GAME_FINISHED', handleGameFinished)
      off('GAME_CLOSED', handleGameClosed)
    }
  }, [emit, isConnected, spectateToken, on, off])

  // Таймер обратного отсчёта для зрителя (локальный)
  useEffect(() => {
    if (timeLeft > 0 && gameStatus === 'active') {
      const timer = setTimeout(() => setTimeLeft((v) => v - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft, gameStatus])

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

  const options = useMemo(() => parseOptions(currentQuestion), [currentQuestion])
  const playersSorted = useMemo(
    () => (Array.isArray(players) ? [...players].sort((a, b) => (b?.score || 0) - (a?.score || 0)) : []),
    [players]
  )

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
        el.style.transition = 'transform 260ms ease'
        el.style.transform = ''
      })
    }

    prevRowTops.current = nextTops
  }, [playersSorted.map((p) => `${p?.player?.id ?? 'x'}:${p?.score ?? 0}`).join('|')])

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
            <p className="opacity-70">{error || 'Попробуй обновить ссылку или создай новую комнату.'}</p>
            <a className="btn btn-primary" href="/">На главную</a>
          </div>
        </div>
      </div>
    )
  }

  const questionChipText = totalQuestions > 0 ? `Вопрос ${questionIndex + 1} из ${totalQuestions}` : null
  const difficulty = game?.difficulty
  const difficultyChip = difficulty
    ? difficultyMeta[difficulty] || { label: String(difficulty).toUpperCase(), badge: 'badge-q6' }
    : null

  return (
    <div className="min-h-screen bg-base-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:basis-4/5 lg:max-w-[80%] space-y-6 lg:order-2">
	            {currentQuestion && gameStatus === 'active' ? (
	              <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible">
	                <div className="absolute -top-3 left-4 flex flex-wrap gap-2 pointer-pass">
	                  {questionChipText && (
	                    <div className="px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
	                      {questionChipText}
	                    </div>
	                  )}
	                  {difficultyChip && (
	                    <div className={`badge gap-2 p-3 rounded-xl font-bold ${difficultyChip.badge}`}>{difficultyChip.label}</div>
	                  )}
	                </div>
	                <div className="card-body pt-8">
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
	                  <h2 className="text-2xl font-bold leading-snug break-words whitespace-pre-line mt-4">{currentQuestion.text}</h2>
	                  <div className="grid gap-4 mt-6">
	                    {options.map((option, index) => {
	                      const isCorrect = correctAnswer !== null && correctAnswer === index
	                      const letter = String.fromCharCode(65 + index)

                      return (
                        <div
                          key={index}
                          className={`p-6 rounded-lg text-xl font-semibold text-center transition-all ${
                            isCorrect ? 'bg-success text-success-content' : 'bg-base-300'
                          }`}
                        >
                          <span className="font-bold mr-4">{letter}.</span>
                          {option}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : gameStatus === 'finished' ? (
              <div className="card glass-card shadow-2xl border border-base-300/60">
                <div className="card-body text-center py-16">
                  <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold">Игра завершена!</h2>
                  <p className="opacity-70">Финальный результат отображён ниже</p>
                </div>
              </div>
            ) : (
              <div className="card glass-card shadow-2xl border border-base-300/60">
                <div className="card-body text-center py-16">
                  <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h2 className="text-2xl font-bold">Игра скоро начнётся</h2>
                  <p className="opacity-70">Ожидаем участников...</p>
                  <div className="mt-4 text-sm opacity-50">Сейчас игроков: {players.length}</div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full lg:basis-1/5 lg:max-w-[20%] lg:order-1">
            <div className="card glass-card shadow-xl border border-base-300/60 w-full relative overflow-visible">
              <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
                Игроки: {playersSorted.length}
              </div>
              <div className="card-body pt-8 space-y-3">
                <div className="grid gap-2 pr-1 max-h-[75vh] overflow-y-auto">
                  {playersSorted.map((p, idx) => (
                    <div
                      key={p?.player?.id ?? idx}
                      ref={(el) => {
                        const id = String(p?.player?.id ?? idx)
                        if (el) playerRowRefs.current.set(id, el)
                        else playerRowRefs.current.delete(id)
                      }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg bg-base-200 border border-[#3a4de6] will-change-transform ${
                        p?.isOnline === false ? 'opacity-60 grayscale' : ''
                      }`}
                    >
                      <span className="w-6 text-center text-sm font-semibold">#{idx + 1}</span>
                      <div className="avatar">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center overflow-hidden">
                          {p?.player?.avatarUrl ? (
                            <img src={p.player.avatarUrl} alt={p.player.username} className="rounded-full" />
                          ) : (
                            <span className="text-sm font-bold">{p?.player?.username?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {p?.player?.username || `${p?.player?.firstName || ''} ${p?.player?.lastName || ''}`.trim() || 'User'}
                        </div>
                      </div>
                      <div className="font-bold tabular-nums">{p?.score ?? 0}</div>
                    </div>
                  ))}

                  {playersSorted.length === 0 && <div className="text-center py-8 opacity-50">Нет игроков</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Spectate
