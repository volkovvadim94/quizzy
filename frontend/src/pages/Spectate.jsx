import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { gameAPI } from '../utils/api'
import { CheckCircle2, Trophy, Volume2, VolumeX, RotateCcw } from 'lucide-react'
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
  const [correctSequence, setCorrectSequence] = useState(null)
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
  const sequenceRevealTimersRef = useRef([])
  const revealDurationRef = useRef(3)
  const freezePlayersRef = useRef(false)
  const pendingPlayersRef = useRef(null)
  const [scoringStep, setScoringStep] = useState('idle') // idle | before | updated | reordered
  const [scoreDeltas, setScoreDeltas] = useState({})
  const [playersView, setPlayersView] = useState([])
  const [sequenceReveal, setSequenceReveal] = useState({ showNumbers: false, reordered: false, highlightCount: 0 })
  const [finishedLeaderboard, setFinishedLeaderboard] = useState([])
  const finishedLeaderboardRef = useRef([])
  const [finishedOnlineById, setFinishedOnlineById] = useState({})
  const [playersGridEl, setPlayersGridEl] = useState(null)
  const [playersGridBox, setPlayersGridBox] = useState({ width: 0, height: 0, isLg: false })

  const resetSequenceReveal = () => setSequenceReveal({ showNumbers: false, reordered: false, highlightCount: 0 })

  const clearScoringTimers = () => {
    for (const t of scoringTimersRef.current) clearTimeout(t)
    scoringTimersRef.current = []
    for (const t of sequenceRevealTimersRef.current) clearTimeout(t)
    sequenceRevealTimersRef.current = []
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
        const lb = response.data.gamePlayers || []
        setFinishedLeaderboard(lb)
        finishedLeaderboardRef.current = lb
        const online = {}
        for (const p of lb) {
          const id = getPublicPlayerId(p)
          if (!id) continue
          online[id] = p?.isOnline !== false
        }
        setFinishedOnlineById(online)
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
          setCorrectSequence(null)
          resetSequenceReveal()
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
      setCorrectAnswer(data && typeof data.correctAnswer === 'number' ? data.correctAnswer : null)
      setCorrectSequence(data && Array.isArray(data.correctSequence) ? data.correctSequence : null)
      setPhase(PHASES.REVEAL)
      setPhaseDuration(revealDurationRef.current)
      setTimeLeft(revealDurationRef.current)
      setBarKey(Date.now())
    }

    const handleGameState = (data) => {
      const status = data.status || 'waiting'
      const nextPlayers = data.gamePlayers || []

      // Finished screen should be a snapshot: keep the final leaderboard order,
      // but mark players offline if they disconnect/leave afterwards.
      if (status === 'finished') {
        const present = new Map()
        for (const p of nextPlayers) {
          const id = getPublicPlayerId(p)
          if (!id) continue
          present.set(id, p?.isOnline !== false)
        }
        setFinishedOnlineById((prev) => {
          const next = { ...prev }
          const snapshot = finishedLeaderboardRef.current || []
          for (const sp of snapshot) {
            const id = getPublicPlayerId(sp)
            if (!id) continue
            if (present.has(id)) next[id] = present.get(id)
            else next[id] = false
          }
          return next
        })
        setGameStatus('finished')
        setPhase(PHASES.FINISHED)
        setTimeLeft(0)
        setPhaseDuration(0)
        return
      }

      if (freezePlayersRef.current) {
        pendingPlayersRef.current = nextPlayers
      } else {
        setPlayers(nextPlayers)
      }
      setGameStatus(status)
      if (status === 'waiting') {
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
      setCorrectSequence(null)
      resetSequenceReveal()
      const lb = data.leaderboard || []
      setPlayers(lb)
      setFinishedLeaderboard(lb)
      finishedLeaderboardRef.current = lb
      const online = {}
      for (const p of lb) {
        const id = getPublicPlayerId(p)
        if (!id) continue
        online[id] = p?.isOnline !== false
      }
      setFinishedOnlineById(online)
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
      setCorrectAnswer(null)
      setCorrectSequence(null)
      resetSequenceReveal()
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

  // Sequence reveal: show target order numbers, reorder cards, then highlight in correct order.
  useEffect(() => {
    if (phase !== PHASES.REVEAL) return
    if (gameStatus !== 'active') return
    if (!currentQuestion || currentQuestion.type !== 'sequence') return
    if (!Array.isArray(correctSequence) || correctSequence.length === 0) return

    for (const t of sequenceRevealTimersRef.current) clearTimeout(t)
    sequenceRevealTimersRef.current = []

    setSequenceReveal({ showNumbers: true, reordered: false, highlightCount: 0 })

    const totalMs = Math.max(300, Math.round(revealDurationRef.current * 1000))
    const reorderAtMs = Math.min(450, Math.max(250, Math.round(totalMs * 0.18)))
    const highlightStartMs = Math.min(totalMs - 50, reorderAtMs + 280)
    const steps = Math.max(1, correctSequence.length)
    const remainingMs = Math.max(0, totalMs - highlightStartMs)
    const stepMs = Math.max(180, Math.floor(remainingMs / steps))

    sequenceRevealTimersRef.current.push(
      setTimeout(() => setSequenceReveal((prev) => ({ ...prev, reordered: true })), reorderAtMs)
    )

    for (let i = 1; i <= steps; i += 1) {
      sequenceRevealTimersRef.current.push(
        setTimeout(() => setSequenceReveal((prev) => ({ ...prev, highlightCount: i })), highlightStartMs + (i - 1) * stepMs)
      )
    }

    return () => {
      for (const t of sequenceRevealTimersRef.current) clearTimeout(t)
      sequenceRevealTimersRef.current = []
    }
  }, [phase, gameStatus, currentQuestion?.id, correctSequence])

  const optionOrder = useMemo(() => {
    const opts = parseOptions(currentQuestion)
    const order = Array.isArray(currentQuestion?.optionOrder) ? currentQuestion.optionOrder : null
    if (order && order.length === opts.length) {
      return opts.map((text, displayIndex) => ({ text, originalIndex: order[displayIndex] ?? displayIndex }))
    }
    return opts.map((text, originalIndex) => ({ text, originalIndex }))
  }, [currentQuestion])

  const isSequenceQuestion = currentQuestion?.type === 'sequence'
  const hasSequenceSolution = isSequenceQuestion && Array.isArray(correctSequence) && correctSequence.length > 0
  // Keep the final "sequence reveal" view (order + greens) until the next question arrives.
  const inSequencePresentation = hasSequenceSolution && (phase === PHASES.REVEAL || phase === PHASES.SCORING)

  const correctPosByOriginalIndex = useMemo(() => {
    const m = new Map()
    if (!Array.isArray(correctSequence)) return m
    for (let i = 0; i < correctSequence.length; i += 1) {
      const raw = correctSequence[i]
      const id = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(id)) continue
      m.set(id, i)
    }
    return m
  }, [Array.isArray(correctSequence) ? correctSequence.join('|') : ''])

  const letterByOriginalIndex = useMemo(() => {
    const m = new Map()
    for (let i = 0; i < optionOrder.length; i += 1) {
      const id = optionOrder[i]?.originalIndex
      if (id === undefined || id === null) continue
      const n = typeof id === 'number' ? id : Number(id)
      if (!Number.isFinite(n)) continue
      m.set(n, String.fromCharCode(65 + i))
    }
    return m
  }, [optionOrder.map((o) => o?.originalIndex).join('|')])

  const displayOptionOrder = useMemo(() => {
    if (!inSequencePresentation || !sequenceReveal.reordered) return optionOrder
    const byId = new Map()
    for (const opt of optionOrder) {
      const id = typeof opt?.originalIndex === 'number' ? opt.originalIndex : Number(opt?.originalIndex)
      if (!Number.isFinite(id)) continue
      byId.set(id, opt)
    }

    const ordered = []
    for (const raw of correctSequence) {
      const id = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(id)) continue
      const opt = byId.get(id)
      if (!opt) continue
      ordered.push(opt)
      byId.delete(id)
    }
    // append leftovers (shouldn't happen normally, but keeps UI stable on malformed data)
    for (const opt of byId.values()) ordered.push(opt)
    return ordered
  }, [optionOrder, inSequencePresentation, sequenceReveal.reordered, Array.isArray(correctSequence) ? correctSequence.join('|') : ''])
  const playersSorted = useMemo(
    () => (Array.isArray(players) ? [...players].sort((a, b) => (b?.score || 0) - (a?.score || 0)) : []),
    [players]
  )

  const renderPlayers = useMemo(() => {
    if (scoringStep !== 'idle' && Array.isArray(playersView) && playersView.length) return playersView
    return playersSorted
  }, [playersSorted, scoringStep, playersView])

  const optionRowRefs = useRef(new Map())
  const prevOptionRowTops = useRef(new Map())

  useLayoutEffect(() => {
    const nextTops = new Map()
    for (const [id, el] of optionRowRefs.current.entries()) {
      if (!el) continue
      nextTops.set(id, el.getBoundingClientRect().top)
    }

    for (const [id, el] of optionRowRefs.current.entries()) {
      if (!el) continue
      const prevTop = prevOptionRowTops.current.get(id)
      const nextTop = nextTops.get(id)
      if (prevTop === undefined || nextTop === undefined) continue
      const delta = prevTop - nextTop
      if (!delta) continue

      el.style.transition = 'transform 0s'
      el.style.transform = `translateY(${delta}px)`
      requestAnimationFrame(() => {
        if (!optionRowRefs.current.get(id)) return
        el.style.transition = 'transform 650ms ease'
        el.style.transform = ''
      })
    }

    prevOptionRowTops.current = nextTops
  }, [displayOptionOrder.map((o) => String(o?.originalIndex ?? '')).join('|')])

  const playerRowRefs = useRef(new Map())
  const prevRowRects = useRef(new Map())

  useLayoutEffect(() => {
    const nextRects = new Map()
    for (const [id, el] of playerRowRefs.current.entries()) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      nextRects.set(id, { top: r.top, left: r.left })
    }

    for (const [id, el] of playerRowRefs.current.entries()) {
      if (!el) continue
      const prev = prevRowRects.current.get(id)
      const next = nextRects.get(id)
      if (!prev || !next) continue
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (!dx && !dy) continue

      el.style.transition = 'transform 0s'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      requestAnimationFrame(() => {
        if (!playerRowRefs.current.get(id)) return
        el.style.transition = 'transform 850ms ease'
        el.style.transform = ''
      })
    }

    prevRowRects.current = nextRects
  }, [renderPlayers.map((p) => `${getPublicPlayerId(p) ?? 'x'}:${p?.score ?? 0}`).join('|')])

  useLayoutEffect(() => {
    const mql = window.matchMedia?.('(min-width: 1024px)')
    const el = playersGridEl
    if (!el) {
      setPlayersGridBox((prev) => ({ ...prev, isLg: !!mql?.matches }))
      return
    }

    let raf = 0
    const update = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setPlayersGridBox({
          width: el.clientWidth || 0,
          height: el.clientHeight || 0,
          isLg: !!mql?.matches,
        })
      })
    }

    update()
    let ro = null
    try {
      ro = new ResizeObserver(update)
      ro.observe(el)
    } catch {
      // ignore
    }
    const onMql = () => update()
    try {
      mql?.addEventListener?.('change', onMql)
    } catch {
      // ignore
    }
    window.addEventListener?.('resize', update)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      try {
        ro?.disconnect?.()
      } catch {
        // ignore
      }
      try {
        mql?.removeEventListener?.('change', onMql)
      } catch {
        // ignore
      }
      window.removeEventListener?.('resize', update)
    }
  }, [playersGridEl])

  const isFinished = gameStatus === 'finished'
  const playersCount = renderPlayers.length

  const playersLayout = useMemo(() => {
    if (isFinished) return { cols: 1, gap: 8, rowHeight: 56, tier: 'normal' }
    const n = Math.max(0, Number(playersCount) || 0)
    const height = Math.max(0, Number(playersGridBox.height) || 0)
    const isLgView = !!playersGridBox.isLg
    const candidates = isLgView ? [1, 2, 3] : [1]
    const minRowByCols = { 1: 58, 2: 46, 3: 36 }
    const gapByCols = { 1: 10, 2: 8, 3: 6 }

    let chosen = { cols: 1, gap: 10, rowHeight: 56 }
    for (const cols of candidates) {
      const rows = Math.max(1, Math.ceil(n / cols))
      const gap = gapByCols[cols] ?? 8
      const rowHeight = rows > 1 ? (height - gap * (rows - 1)) / rows : height
      chosen = { cols, gap, rowHeight }
      if (!height) break
      if (rowHeight >= (minRowByCols[cols] ?? 40)) break
    }

    const rh = Math.max(20, Math.floor(chosen.rowHeight || 0))
    const tier = rh >= 66 ? 'normal' : rh >= 56 ? 'compact' : rh >= 44 ? 'ultra' : 'micro'
    return { cols: chosen.cols, gap: chosen.gap, rowHeight: rh, tier }
  }, [isFinished, playersCount, playersGridBox.height, playersGridBox.isLg])

  const questionWidthClass = isFinished
    ? 'lg:basis-full lg:max-w-full'
    : playersLayout.cols === 3
    ? 'lg:basis-[52%] lg:max-w-[52%]'
    : playersLayout.cols === 2
    ? 'lg:basis-[62%] lg:max-w-[62%]'
    : 'lg:basis-[74%] lg:max-w-[74%]'

  const playersWidthClass =
    playersLayout.cols === 3
      ? 'lg:basis-[48%] lg:max-w-[48%]'
      : playersLayout.cols === 2
      ? 'lg:basis-[38%] lg:max-w-[38%]'
      : 'lg:basis-[26%] lg:max-w-[26%]'

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
  const showDelta = scoringStep === 'updated'

  return (
    <div className="w-full h-full px-6 lg:px-10 pt-10 pb-10">
      <div className="w-full h-full">
        <div className="flex flex-col lg:flex-row gap-8 items-stretch h-full">
          <div
            className={`w-full ${questionWidthClass} lg:order-2 flex flex-col min-h-0`}
          >
            <div
              className={`card shadow-2xl border border-base-300/60 relative overflow-visible flex-1 h-full min-h-0 ${
                isFinished ? 'overflow-hidden' : ''
              }`}
              style={{ background: '#11192a' }}
            >
              {!isFinished ? (
                <div className="absolute -top-3 left-4 flex flex-wrap gap-2 pointer-pass">
                  {gameStatus === 'active' ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass max-w-[70vw] lg:max-w-[820px] truncate">
                        {game?.topic || game?.topicName || 'Тема'}
                      </div>
                      {difficultyChip ? (
                        <div className={`badge gap-2 p-3 rounded-xl font-bold ${difficultyChip.badge}`}>
                          {difficultyChip.label}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="card-body pt-10 flex flex-col h-full min-h-0">
                  {isFinished ? (
                    <>
                      <div className="text-center pt-2 pb-6 shrink-0">
                        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                        <h1 className="text-4xl lg:text-5xl font-black mb-2">Игра завершена!</h1>
                        <div className="opacity-70 text-lg">Можно закрыть вкладку</div>
                      </div>

                      <div className="scroll-mask flex-1 min-h-0 overflow-y-auto pr-1">
                        <div className="w-full max-w-[760px] mx-auto space-y-3 pb-1">
                          {(finishedLeaderboard.length ? finishedLeaderboard : playersSorted).map((player, index) => {
                            const id = getPublicPlayerId(player)
                            const online = id ? finishedOnlineById?.[id] : player?.isOnline !== false
                            return (
                            <div
                              key={player?.player?.id ?? player?.playerId ?? index}
                              className={`w-full flex items-center gap-4 p-4 rounded-lg ${
                                index === 0
                                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                                  : index === 1
                                  ? 'bg-gradient-to-r from-gray-500 to-slate-600 text-white'
                                  : index === 2
                                  ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white'
                                  : 'bg-[#0f1626] border border-[#3a4de6]/60'
                              } ${online === false ? 'opacity-70 grayscale' : ''}`}
                            >
                              <div className="w-10 h-10 rounded-full bg-black/20 border border-[#3a4de6]/60 flex items-center justify-center font-black text-lg tabular-nums">
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
                            )
                          })}
                        </div>
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
                        {displayOptionOrder.map((opt, displayIndex) => {
                          const rawId = opt?.originalIndex
                          const originalIndex = typeof rawId === 'number' ? rawId : Number(rawId)
                          const hasOriginal = Number.isFinite(originalIndex)
                          const stableId = hasOriginal ? String(originalIndex) : String(displayIndex)

                          const correctPos = inSequencePresentation && hasOriginal ? correctPosByOriginalIndex.get(originalIndex) : undefined
                          const orderNumber = correctPos !== undefined ? correctPos + 1 : null
                          const isSeqHighlighted =
                            inSequencePresentation && correctPos !== undefined && correctPos < (sequenceReveal?.highlightCount || 0)

                          const isCorrect =
                            !inSequencePresentation && correctAnswer !== null && hasOriginal && Number(correctAnswer) === originalIndex
                          const isDimmed = !inSequencePresentation && correctAnswer !== null && !isCorrect

                          const letter = hasOriginal ? letterByOriginalIndex.get(originalIndex) || String.fromCharCode(65 + displayIndex) : String.fromCharCode(65 + displayIndex)

                          const base = inSequencePresentation
                            ? isSeqHighlighted
                              ? 'bg-green-700 border-green-500 text-white shadow-md'
                              : 'bg-base-200 border-base-300/60 text-white shadow-md'
                            : correctAnswer === null
                            ? 'bg-base-200 border-base-300/60 text-white shadow-md'
                            : isCorrect
                            ? 'bg-green-700 border-green-500 text-white shadow-md'
                            : 'bg-base-200 border-base-300/60 text-white shadow-sm'

                          return (
                            <div
                              key={stableId}
                              ref={(el) => {
                                if (el) optionRowRefs.current.set(stableId, el)
                                else optionRowRefs.current.delete(stableId)
                              }}
                              className={`w-full px-7 py-5 rounded-2xl border transition-colors duration-200 will-change-transform ${base} ${
                                isDimmed ? 'opacity-70' : ''
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <span className="w-10 h-10 rounded-full bg-black/20 border border-white/10 flex items-center justify-center font-black text-lg">
                                  {letter}
                                </span>
                                <span className="text-xl font-semibold flex-1 min-w-0 text-center break-words">{opt.text}</span>
                                {inSequencePresentation && sequenceReveal?.showNumbers && orderNumber !== null ? (
                                  <span className="w-10 h-10 rounded-full bg-black/20 border border-white/10 flex items-center justify-center font-black text-lg tabular-nums">
                                    {orderNumber}
                                  </span>
                                ) : null}
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
                          <div className="w-full max-w-4xl mx-auto">
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
                          <div className="mt-2 text-2xl font-semibold opacity-80 whitespace-nowrap overflow-x-auto scroll-mask">
                            {telegramJoinUrl || joinUrl}
                          </div>
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

          {!isFinished ? (
          <div
            className={`w-full ${playersWidthClass} lg:order-1 flex flex-col min-h-0`}
          >
            <div className="card glass-card shadow-xl border border-base-300/60 w-full relative overflow-visible flex-1 h-full min-h-0">
              <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-[#e5d423] text-black text-xs font-bold uppercase pointer-pass">
                Игроки: {renderPlayers.length}
              </div>
              <div className="card-body pt-8 flex flex-col min-h-0">
                <div
                  ref={setPlayersGridEl}
                  className="grid pr-1 flex-1 min-h-0 overflow-hidden"
                  style={{
                    gridTemplateColumns: `repeat(${playersLayout.cols}, minmax(0, 1fr))`,
                    gridAutoRows: playersGridBox.height ? `${playersLayout.rowHeight}px` : undefined,
                    gap: `${playersLayout.gap}px`,
                  }}
                >
                  {renderPlayers.map((p, idx) => {
                    const id = getPublicPlayerId(p)
                    const delta = id ? scoreDeltas[id] : 0
                    const hasAnswered = p?.currentAnswer !== null && p?.currentAnswer !== undefined
                    const isReadyState = gameStatus === 'active' ? hasAnswered : !!p?.isReady
                    return (
                    <div
                      key={p?.player?.id ?? p?.playerId ?? idx}
                      ref={(el) => {
                        const rid = String(getPublicPlayerId(p) ?? idx)
                        if (el) playerRowRefs.current.set(rid, el)
                        else playerRowRefs.current.delete(rid)
                      }}
                      className={`h-full flex items-center gap-3 overflow-hidden ${
                        playersLayout.tier === 'micro'
                          ? 'px-2 py-1.5'
                          : playersLayout.tier === 'ultra'
                          ? 'px-2 py-2'
                          : playersLayout.tier === 'compact'
                          ? 'px-3 py-3'
                          : 'px-4 py-4'
                      } rounded-xl bg-base-200 border border-[#3a4de6] will-change-transform ${
                        p?.isOnline === false ? 'opacity-60 grayscale' : ''
                      }`}
                    >
                      <span
                        className={`rounded-full bg-black/20 border border-[#3a4de6]/60 flex items-center justify-center font-black tabular-nums ${
                          playersLayout.tier === 'micro'
                            ? 'w-5 h-5 text-[10px]'
                            : playersLayout.tier === 'ultra'
                            ? 'w-6 h-6 text-xs'
                            : playersLayout.tier === 'compact'
                            ? 'w-7 h-7 text-sm'
                            : 'w-8 h-8 text-base'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="avatar">
                        <div
                          className={`rounded-full bg-primary text-primary-content flex items-center justify-center overflow-hidden ${
                            playersLayout.tier === 'micro'
                              ? 'w-7 h-7'
                              : playersLayout.tier === 'ultra'
                              ? 'w-8 h-8'
                              : playersLayout.tier === 'compact'
                              ? 'w-9 h-9'
                              : 'w-11 h-11'
                          }`}
                        >
                          {p?.player?.avatarUrl ? (
                            <img src={p.player.avatarUrl} alt={p?.player?.username || 'player'} className="rounded-full" />
                          ) : (
                            <span
                              className={`${
                                playersLayout.tier === 'micro' ? 'text-[10px]' : playersLayout.tier === 'ultra' ? 'text-xs' : 'text-sm'
                              } font-bold`}
                            >
                              {p?.player?.username?.charAt(0) || 'U'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-semibold truncate ${
                            playersLayout.tier === 'micro' ? 'text-xs' : playersLayout.tier === 'ultra' ? 'text-sm' : 'text-base'
                          }`}
                        >
                          {p?.player?.username || `${p?.player?.firstName || ''} ${p?.player?.lastName || ''}`.trim() || 'User'}
                        </div>
                      </div>
                      <div
                        className={`relative flex items-center justify-end ${
                          playersLayout.tier === 'micro'
                            ? 'min-w-[86px]'
                            : playersLayout.tier === 'ultra'
                            ? 'min-w-[96px]'
                            : playersLayout.tier === 'compact'
                            ? 'min-w-[108px]'
                            : 'min-w-[120px]'
                        }`}
                      >
                        {showDelta && delta > 0 ? (
                          <div
                            key={`${id ?? idx}:${delta}:${barKey}`}
                            className={`quizzy-float-up text-green-300 font-black tabular-nums ${
                              playersLayout.tier === 'micro' ? 'text-xs' : 'text-sm'
                            }`}
                          >
                            +{delta}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <div
                            className={`font-black tabular-nums leading-none ${
                              playersLayout.tier === 'micro'
                                ? 'text-base'
                                : playersLayout.tier === 'ultra'
                                ? 'text-lg'
                                : 'text-xl'
                            }`}
                          >
                            {p?.score ?? 0}
                          </div>
                          <CheckCircle2
                            size={playersLayout.tier === 'micro' ? 14 : playersLayout.tier === 'ultra' ? 16 : 18}
                            className={`${isReadyState ? 'text-green-400' : 'text-base-300/70'} shrink-0`}
                          />
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
