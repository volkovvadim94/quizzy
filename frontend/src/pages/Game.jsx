import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useSocket } from '../hooks/useSocket'
import { clearActiveGame, getClientSessionId, setActiveGame } from '../utils/storage'
import { Clock, Users, Trophy, Zap, CheckCircle2, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import Snackbar from '../components/feedback/Snackbar'
import LoadingScreen from '../components/feedback/LoadingScreen'
import PlayerTile from '../components/players/PlayerTile'
import CountdownRing from '../components/game/CountdownRing'
import { tgTopPadding } from '../utils/safeArea'
import { isTelegramWebApp } from '../utils/telegram'


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

const palette = {
  primary: 'var(--qz-blue)',
  primary10: 'var(--qz-blue-10)',
  primary60: 'var(--qz-blue-60)',
  text: 'var(--qz-text)',
  muted: 'var(--qz-gray)',
  white: 'var(--qz-white)',
  black: 'var(--qz-black)',
  black5: 'var(--qz-black-5)',
  black50: 'var(--qz-black-50)',
  yellow: 'var(--qz-yellow)',
  success: 'var(--qz-success)',
  error: 'var(--qz-error)',
}

const Game = () => {
  const { gameId: gameIdParam } = useParams()
  const { user, refreshMe } = useAuth()
  const { features } = useConfig()

  const { socket, emit, on, off } = useSocket()
  const navigate = useNavigate()

  const gameId = String(gameIdParam || '').toUpperCase()
  const isWebApp = useMemo(() => isTelegramWebApp(), [])
  const topPadding = tgTopPadding(isWebApp, { defaultExtraPx: 12 })


  const [phase, setPhase] = useState(PHASES.LOADING)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [shuffledOptions, setShuffledOptions] = useState([]) // [{ text, originalIndex }]
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [questionDuration, setQuestionDuration] = useState(20)
  const [revealDuration, setRevealDuration] = useState(5)
  const [selectedOption, setSelectedOption] = useState(null)
  // For sequence questions: list of display indices in the order chosen by the player (e.g. [3,0,2,1]).
  const [sequenceOrder, setSequenceOrder] = useState([])
  const [submittedSequence, setSubmittedSequence] = useState(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [correctAnswer, setCorrectAnswer] = useState(null)
  const [correctSequence, setCorrectSequence] = useState(null)
  const [players, setPlayers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [organizerId, setOrganizerId] = useState(null)
  const [barKey, setBarKey] = useState(0)
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const [mediaHint, setMediaHint] = useState({ audio: false, video: false })
  const [mediaMuted, setMediaMuted] = useState(false);
  const [mediaVolume, setMediaVolume] = useState(0.9);
  const [snackbar, setSnackbar] = useState({
    message: '',
    type: 'success',
    visible: false
  });
  const [flashCorrect, setFlashCorrect] = useState(false);
  const snackTimer = useRef(null)
  const lastQuestionIdRef = useRef(null)
  const scoringTimersRef = useRef([])
  const [scoreOverlay, setScoreOverlay] = useState({
    visible: false,
    hiding: false,
    step: 'idle',
    beforeById: {},
    afterById: {},
    displayPlayers: [],  // ← ДОБАВИТЬ
    changedIds: [],      // ← ДОБАВИТЬ (опционально, но используется)
  })
  const scoreRowRefs = useRef(new Map())
  const prevScoreRowTops = useRef(new Map())
  const [sequenceAnimating, setSequenceAnimating] = useState(false)
  const sequenceAnimTimerRef = useRef(null)
  const sequenceRowRefs = useRef(new Map())
  const prevSequenceRowTops = useRef(new Map())


  const showSnackbar = (message, type = 'success') => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnackbar({ message, type, visible: true });
    snackTimer.current = setTimeout(
      () => setSnackbar(prev => ({ ...prev, visible: false })),
      2000
    );
  };
  const getPublicPlayerId = (p) => p?.playerId ?? p?.player?.id ?? null

  const tryReplay = async (kind) => {
    const el = kind === 'video' ? videoRef.current : audioRef.current;
    if (!el) return;
    try {
      const vol = mediaMuted ? 0 : mediaVolume;
      el.muted = !!mediaMuted;
      el.volume = Math.min(1, Math.max(0, vol));
      el.pause?.();
      el.currentTime = 0;
      await el.play?.();
      setMediaHint(prev => ({ ...prev, [kind]: false }));
    } catch {
      setMediaHint(prev => ({ ...prev, [kind]: true }));
    }
  };
  const clearScoringTimers = () => {
    scoringTimersRef.current.forEach(timer => clearTimeout(timer));
    scoringTimersRef.current = [];
  };
  useLayoutEffect(() => {
    if (!scoreOverlay.visible) {
      prevScoreRowTops.current = new Map()
      return
    }
    const nextTops = new Map();  // ← ДОБАВИТЬ эту строку
    for (const [id, el] of scoreRowRefs.current.entries()) {
      if (!el) continue
      nextTops.set(id, el.getBoundingClientRect().top)
    }


    // ДОБАВИТЬ КОД АНИМАЦИИ:
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


  useLayoutEffect(() => {
    const isSeq = currentQuestion?.type === 'sequence'
    if (!isSeq || phase !== PHASES.QUESTION || hasSubmitted) {
      prevSequenceRowTops.current = new Map()
      return
    }

    const nextTops = new Map()
    for (const [id, el] of sequenceRowRefs.current.entries()) {
      if (!el) continue
      nextTops.set(id, el.getBoundingClientRect().top)
    }

    if (!prevSequenceRowTops.current.size) {
      prevSequenceRowTops.current = nextTops
      return
    }

    for (const [id, el] of sequenceRowRefs.current.entries()) {
      if (!el) continue
      const prevTop = prevSequenceRowTops.current.get(id)
      const nextTop = nextTops.get(id)
      if (prevTop === undefined || nextTop === undefined) continue
      const delta = prevTop - nextTop
      if (!delta) continue

      el.style.transition = 'transform 0s'
      el.style.transform = `translateY(${delta}px)`
      requestAnimationFrame(() => {
        if (!sequenceRowRefs.current.get(id)) return
        el.style.transition = 'transform 500ms ease'
        el.style.transform = ''
      })
    }

    prevSequenceRowTops.current = nextTops
  }, [currentQuestion?.id, phase, hasSubmitted, sequenceOrder.join('|')])
  useEffect(() => {
    return () => {
      if (snackTimer.current) clearTimeout(snackTimer.current)
      clearScoringTimers()
      if (sequenceAnimTimerRef.current) clearTimeout(sequenceAnimTimerRef.current)
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
      clearScoringTimers();
      setScoreOverlay((prev) => (prev.visible ? { ...prev, visible: false, hiding: false, step: 'idle' } : prev));
      setPhase(PHASES.QUESTION);
      const q = data.question;
      if (q?.id && lastQuestionIdRef.current === q.id) return;
      lastQuestionIdRef.current = q?.id ?? null;

      setCurrentQuestion(q);
      const options = parseOptions(q);
      const order = Array.isArray(q?.optionOrder) ? q.optionOrder : null;
      const perm =
        order && order.length === options.length
          ? options.map((text, displayIndex) => ({
            text,
            originalIndex: order[displayIndex] ?? displayIndex
          }))
          : buildShuffledOptions(options);

      setShuffledOptions(perm);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(typeof data.totalQuestions === 'number' ? data.totalQuestions : 0);

      const qd = Math.max(1, Math.round((data.questionTimeMs || 20000) / 1000))
      const rd = Math.max(1, Math.round((data.revealTimeMs || 5000) / 1000))
      setQuestionDuration(qd)
      setRevealDuration(rd)
      setTimeLeft(qd)

      if (q?.type === 'sequence') {
        setSequenceOrder([]);
      } else {
        setSelectedOption(null);
      }

      setSequenceAnimating(false);
      if (sequenceAnimTimerRef.current) clearTimeout(sequenceAnimTimerRef.current);
      sequenceAnimTimerRef.current = null;
      prevSequenceRowTops.current = new Map();
      setSubmittedSequence(null);
      setHasSubmitted(false);
      setCorrectAnswer(null);
      setCorrectSequence(null);
      setMediaHint({ audio: false, video: false });
    };
    on('NEW_QUESTION', handleNewQuestion)

    const handleQuestionEnded = (data) => {
      clearScoringTimers()
      setPhase(PHASES.REVEAL)
      setCorrectAnswer(data.correctAnswer)
      setCorrectSequence(data.correctSequence || null)
      setTimeLeft(revealDuration)
      setSequenceAnimating(false)
      if (sequenceAnimTimerRef.current) clearTimeout(sequenceAnimTimerRef.current)
      sequenceAnimTimerRef.current = null
    }
    on('QUESTION_ENDED', handleQuestionEnded)

    // ДОБАВИТЬ обработчик handleScorePhase из рабочего кода:
    const handleScorePhase = (data) => {
      clearScoringTimers();
      try {
        const before = Array.isArray(data?.beforePlayers) ? data.beforePlayers : [];
        const after = Array.isArray(data?.afterPlayers) ? data.afterPlayers : [];
        const scoringMs = typeof data?.scoringTimeMs === 'number' ? data.scoringTimeMs : 5000;
        const hideAnimMs = 220;

        const beforeClean = before.filter((p) => p && getPublicPlayerId(p));
        const afterClean = after.filter((p) => p && getPublicPlayerId(p));

        const beforeById = {};
        for (const p of beforeClean) {
          const id = getPublicPlayerId(p);
          if (!id) continue;
          beforeById[id] = p;
        }
        const afterById = {};
        for (const p of afterClean) {
          const id = getPublicPlayerId(p);
          if (!id) continue;
          afterById[id] = p;
        }

        const beforeSorted = [...beforeClean].sort((a, b) => (b?.score || 0) - (a?.score || 0));
        const changedIds = beforeSorted
          .map((p) => getPublicPlayerId(p))
          .filter(Boolean)
          .filter((id) => (afterById[id]?.score ?? beforeById[id]?.score ?? 0) !== (beforeById[id]?.score ?? 0));

        // öó‘?‘<?øç? õ‘??‘?>‘<ü ??õ‘??‘?, õ?óø ?ç? ???‘<ü
        setCurrentQuestion(null);
        setShuffledOptions([]);
        setSelectedOption(null);
        setSequenceOrder([]);
        setSubmittedSequence(null);
        setHasSubmitted(false);
        setCorrectAnswer(null);
        setCorrectSequence(null);
        lastQuestionIdRef.current = null;

        setPhase(PHASES.SCORING);
        setTimeLeft(0);
        setScoreOverlay({
          visible: true,
          hiding: false,
          step: 'before',
          changedIds,
          displayPlayers: beforeSorted,  // ¢Å? ÷?ÿ¿ ö÷¿!
          beforeById,
          afterById,
        });

        // t=1s: apply score changes (keep current order)
        scoringTimersRef.current.push(
          setTimeout(() => {
            setScoreOverlay((prev) => {
              const next = prev.displayPlayers.map((p) => {
                const id = getPublicPlayerId(p);
                if (!id) return p;
                const afterP = prev.afterById[id];
                return afterP ? { ...p, score: afterP.score } : p;
              });
              return { ...prev, step: 'updated', displayPlayers: next };
            });
          }, 1000)
        );

        // t=2s: reorder by updated score
        scoringTimersRef.current.push(
          setTimeout(() => {
            setScoreOverlay((prev) => {
              const next = [...prev.displayPlayers].sort((a, b) => (b?.score || 0) - (a?.score || 0));
              return { ...prev, step: 'reordered', displayPlayers: next };
            });
          }, 2000)
        );

        // start fade-out slightly before the end
        scoringTimersRef.current.push(
          setTimeout(() => {
            setScoreOverlay((prev) => (prev.visible ? { ...prev, hiding: true } : prev));
          }, Math.max(0, scoringMs - hideAnimMs))
        );
        scoringTimersRef.current.push(
          setTimeout(() => {
            setScoreOverlay((prev) =>
              prev.visible ? { ...prev, visible: false, hiding: false, step: 'idle' } : prev
            );
          }, scoringMs)
        );
      } catch (err) {
        console.error('Failed to handle score phase', err);
      }
    };

    on('SCORE_PHASE', handleScorePhase);

    // ДОБАВИТЬ недостающие обработчики:
    const handleGameFinished = (data) => {
      refreshMe();
      clearScoringTimers();
      setScoreOverlay((prev) => (prev.visible ? { ...prev, visible: false, hiding: false, step: 'idle' } : prev));
      setPhase(PHASES.FINISHED);
      setLeaderboard((prev) =>
        data.leaderboard && data.leaderboard.length ? data.leaderboard : prev && prev.length ? prev : []
      );
      clearActiveGame();
    };
    on('GAME_FINISHED', handleGameFinished);

    const handleGameState = (data) => {
      setActiveGame(gameId, data.status === 'active' ? 'active' : 'room');

      if (data.status === 'waiting') {
        navigate(`/room/${gameId}`, { replace: true });
        return;
      }

      if (data.status === 'finished') {
        clearActiveGame();
        return;
      }

      // active
      setPlayers(data.gamePlayers || []);
      setOrganizerId(data.organizerId || null);
    };
    on('GAME_STATE', handleGameState);

    const handleGameClosed = () => {
      clearScoringTimers();
      setScoreOverlay({ visible: false, hiding: false, step: 'idle', beforeById: {}, afterById: {}, displayPlayers: [], changedIds: [] });
      setPhase(PHASES.LOADING);
      clearActiveGame();
      navigate('/', { replace: true });
    };
    on('GAME_CLOSED', handleGameClosed);

    const handleSessionTakenOver = () => {
      clearActiveGame();
      navigate(`/session-switched?gameId=${encodeURIComponent(gameId)}`, { replace: true });
    };
    on('SESSION_TAKEN_OVER', handleSessionTakenOver);

    const handleError = (err) => {
      const msg = err?.message || err?.error || 'Ошибка';
      if (String(msg).toLowerCase().includes('переполн')) {
        clearActiveGame();
        showSnackbar('Комната переполнена', 'error');
        navigate('/', { replace: true });
        return;
      }
      if (String(msg).toLowerCase().includes('комната не найдена')) {
        clearActiveGame();
        showSnackbar('Комната не найдена', 'error');
        navigate('/', { replace: true });
        return;
      }
      showSnackbar(msg, 'error');
    };
    on('ERROR', handleError);

    const join = () =>
      emit('JOIN_GAME', { gameId, playerId: user.id, player: user, clientSessionId: getClientSessionId() });
    if (socket.connected) join();
    on('connect', join);

    return () => {
      off('GAME_LOADING', handleGameLoading);
      off('NEW_QUESTION', handleNewQuestion);
      off('QUESTION_ENDED', handleQuestionEnded);
      off('SCORE_PHASE', handleScorePhase);
      off('GAME_FINISHED', handleGameFinished);
      off('GAME_STATE', handleGameState);
      off('GAME_CLOSED', handleGameClosed);
      off('GAME_STARTED', handleGameStarted);
      off('SESSION_TAKEN_OVER', handleSessionTakenOver);
      off('ERROR', handleError);
      off('connect', join);
    };
  }, [socket, emit, on, off, gameId, gameIdParam, user, navigate, leaderboard.length, revealDuration, refreshMe]);


  useEffect(() => {
    if (phase === PHASES.QUESTION && timeLeft === 0 && !hasSubmitted && currentQuestion) {
      if (currentQuestion.type === 'sequence') {
        if (sequenceOrder.length > 0) handleSubmitAnswer(sequenceOrder)
      } else if (selectedOption !== null && selectedOption !== undefined) {
        handleSubmitAnswer(selectedOption)
      }
    }
  }, [phase, timeLeft, selectedOption, sequenceOrder, currentQuestion, hasSubmitted])

  const handleAnswerSelect = (answerIndex) => {
    if (phase !== PHASES.QUESTION || hasSubmitted) return;

    if (currentQuestion?.type === 'sequence') {
      if (sequenceAnimating) return;
      setSequenceAnimating(true);
      if (sequenceAnimTimerRef.current) clearTimeout(sequenceAnimTimerRef.current);
      sequenceAnimTimerRef.current = setTimeout(() => setSequenceAnimating(false), 500);

      // НОВАЯ ЛОГИКА: добавление/удаление из выбранных
      setSequenceOrder((prev) =>
        prev.includes(answerIndex)
          ? prev.filter((v) => v !== answerIndex)
          : [...prev, answerIndex]
      );
    } else {
      setSelectedOption(answerIndex);
    }
  };


  const handleSubmitAnswer = (answerPayload) => {
    if (phase !== PHASES.QUESTION || hasSubmitted) return;

    setHasSubmitted(true); // ДОБАВИТЬ эту строку!

    const optionOrder = shuffledOptions && shuffledOptions.length
      ? shuffledOptions
      : parseOptions(currentQuestion).map((text, originalIndex) => ({ text, originalIndex }));

    if (currentQuestion?.type === 'sequence') {
      const picked = Array.isArray(answerPayload) ? answerPayload : sequenceOrder;
      const seq = picked.map((displayIndex) =>
        optionOrder[displayIndex]?.originalIndex
      ).filter((v) => typeof v === 'number');

      setSubmittedSequence(seq);
      emit('SUBMIT_ANSWER', {
        gameId,
        questionId: currentQuestion.id,
        sequence: seq,
        playerId: user.id,
      });
    } else {
      // ДОБАВИТЬ обработку обычных вопросов:
      const idx = typeof answerPayload === 'number' ? answerPayload : selectedOption;
      const answerIndex = optionOrder[idx]?.originalIndex ?? idx;
      emit('SUBMIT_ANSWER', {
        gameId,
        questionId: currentQuestion.id,
        answerIndex,
        playerId: user.id,
      });
    }
  };
  const getOptionLetter = (index) => String.fromCharCode(65 + index)
  const scoreListMaxHeight = isWebApp ? 'calc(100vh - 280px)' : 'calc(100vh - 200px)'

  const showGlobalLoading = phase === PHASES.LOADING

  if (phase === PHASES.FINISHED) {
    return (
      <div
        className="page-shell content-container flex-1 min-h-0 flex flex-col items-center px-4 pb-12"
        style={{ paddingTop: topPadding }}
      >
        <div className={`flex-1 min-h-0 flex flex-col w-full ${leaderboard.length === 1 ? 'justify-center' : ''}`}>
          <div className="text-center pb-4">
            <Trophy className="w-16 h-16 mx-auto mb-4" style={{ color: palette.yellow }} />
            <h1 className="text-[24px] leading-[30px] font-extrabold text-[var(--qz-text)]">Игра завершена</h1>
            <div className="text-sm text-[var(--qz-muted)] mt-1">Глобальный рейтинг обновлен</div>
          </div>

          <div className="bg-white border rounded-[10px] shadow-sm overflow-hidden w-full max-w-[900px] mx-auto" style={{ borderColor: palette.black5 }}>
            <div
              className="scroll-mask overflow-y-auto"
              style={{ maxHeight: scoreListMaxHeight }}
            >
              {leaderboard.map((player, index) => (
                <div
                  key={player.player.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: palette.black5 }}
                >
                  <div className="px-4 py-3">
                    <PlayerTile
                      mode="game"
                      index={index + 1}
                      player={player.player}
                      isOnline={true}
                      isSelf={player.player.id === user?.id}
                      isOrganizer={organizerId ? player.player.id === organizerId : false}
                      showReady={false}
                      showMetaOverride={false}
                      showTier={false}
                      totalScore={player.player?.totalScore}
                      gameScore={player.score}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-5 w-full flex justify-center">
          <button
            className="w-full max-w-[480px] h-[50px] rounded-[12px] text-[17px] leading-[22px] font-semibold shadow-lg"
            onClick={() => {
              emit('LEAVE_GAME', { gameId, playerId: user.id })
              clearActiveGame()
              navigate('/', { replace: true })
            }}
            style={{ backgroundColor: palette.primary, color: palette.white }}
          >
            Подтвердить
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
  const isSequence = currentQuestion?.type === 'sequence'
  const selectionComplete = isSequence ? options.length > 0 && sequenceOrder.length === options.length
    : selectedOption !== null && selectedOption !== undefined
  const canSubmit = phase === PHASES.QUESTION && !hasSubmitted && selectionComplete

  const pictureUrl = normalizeMediaUrl(currentQuestion?.picture, 'pictures')
  const hasPicture = pictureUrl && !isPlaceholderMedia(pictureUrl)
  const showQuestionText = Boolean(currentQuestion?.text && !hasPicture)

  const submittedOriginalIndex =
    !isSequence && selectedOption !== null && selectedOption !== undefined
      ? optionOrder[selectedOption]?.originalIndex ?? null
      : null

  const bottomText =
    phase === PHASES.QUESTION && hasSubmitted
      ? 'Ждем остальных'
      : phase === PHASES.REVEAL
        ? 'Подводим итоги'
        : ''

  const bottomPadding = 'calc(env(safe-area-inset-bottom, 0px) + 34px)'
  const compactScoreOverlay = (scoreOverlay.displayPlayers?.length || 0) <= 7

  return (
    <div className="page-shell content-container flex flex-col flex-1 min-h-0 bg-white">
      <LoadingScreen
        visible={showGlobalLoading}
        minDuration={600}
        message="Загружаем игру"
        subtext="Подключаемся к участникам и загружаем вопросы"
      />
      {scoreOverlay.visible ? (
        <div
          className={`fixed inset-0 z-50 bg-white transition-opacity duration-200 ${scoreOverlay.hiding ? 'opacity-0' : 'opacity-100'}`}
          aria-live="polite"
        >
          <div
            className="h-full flex flex-col min-h-0 px-3"
            style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}
          >
            {compactScoreOverlay ? (
              <div
                className="content-container flex flex-col items-center gap-3 py-4"
                style={{ marginTop: 'auto', marginBottom: 'auto' }}
              >
                <div className="text-center text-[20px] leading-[26px] font-extrabold text-[var(--qz-text)]">Счет</div>

                <div
                  className="w-full max-w-[900px] mx-auto bg-white border rounded-[10px] overflow-y-auto scroll-mask"
                  style={{ borderColor: palette.black5, maxHeight: scoreListMaxHeight }}
                >
                  <div className="divide-y" style={{ borderColor: palette.black5 }}>
                    {(scoreOverlay.displayPlayers || []).map((p, idx) => {
                      const id = getPublicPlayerId(p)
                      if (!id) return null
                      const basePlayer = p?.player || { id, username: 'Игрок' }

                      const beforeScore = scoreOverlay.beforeById[id]?.score ?? p.score ?? 0
                      const afterScore = scoreOverlay.afterById[id]?.score ?? p.score ?? 0
                      const delta = afterScore - beforeScore
                      const showDeltaPhase = scoreOverlay.step === 'before'
                      const deltaText = showDeltaPhase ? (delta ? (delta > 0 ? `+${delta}` : `${delta}`) : '0') : ''
                      const deltaTone = delta < 0 ? 'danger' : delta > 0 ? 'success' : 'neutral'
                      const scoreDisplayOverride = showDeltaPhase ? deltaText : null
                      const animateScore = !showDeltaPhase

                      return (
                        <div
                          key={id}
                          ref={(el) => {
                            if (el) scoreRowRefs.current.set(id, el)
                            else scoreRowRefs.current.delete(id)
                          }}
                          className="px-4"
                        >
                          <PlayerTile
                            mode="game"
                            index={idx + 1}
                            player={basePlayer}
                            isOnline={p.isOnline !== false}
                            isSelf={id === user?.id}
                            isOrganizer={organizerId ? id === organizerId : false}
                            showReady={false}
                            showMetaOverride={true}
                            showTier={false}
                            totalScore={basePlayer?.totalScore ?? p?.totalScore}
                            scoreDisplayOverride={scoreDisplayOverride}
                            scoreTone={deltaTone}
                            animateScore={animateScore}
                            gameScore={typeof p.score === 'number' ? p.score : 0}
                            deltaText=""
                            deltaTone={deltaTone}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="content-container flex flex-col gap-3 py-4 mx-auto w-full max-w-[1000px]">
                <div className="text-center text-[20px] leading-[26px] font-extrabold text-[var(--qz-text)]">Счет</div>

                <div className="flex-1 min-h-0 w-full max-w-[900px] mx-auto bg-white border rounded-[10px] overflow-hidden" style={{ borderColor: palette.black5 }}>
                  <div className="h-full overflow-y-auto scroll-mask">
                    <div className="divide-y" style={{ borderColor: palette.black5 }}>
                      {(scoreOverlay.displayPlayers || []).map((p, idx) => {
                        const id = getPublicPlayerId(p)
                        if (!id) return null
                        const basePlayer = p?.player || { id, username: 'Игрок' }

                        const beforeScore = scoreOverlay.beforeById[id]?.score ?? p.score ?? 0
                        const afterScore = scoreOverlay.afterById[id]?.score ?? p.score ?? 0
                        const delta = afterScore - beforeScore
                        const showDeltaPhase = scoreOverlay.step === 'before'
                        const deltaText = showDeltaPhase ? (delta ? (delta > 0 ? `+${delta}` : `${delta}`) : '0') : ''
                        const deltaTone = delta < 0 ? 'danger' : delta > 0 ? 'success' : 'neutral'
                        const scoreDisplayOverride = showDeltaPhase ? deltaText : null
                        const animateScore = !showDeltaPhase

                        return (
                          <div
                            key={id}
                            ref={(el) => {
                              if (el) scoreRowRefs.current.set(id, el)
                              else scoreRowRefs.current.delete(id)
                            }}
                            className="px-4"
                          >
                          <PlayerTile
                            mode="game"
                            index={idx + 1}
                            player={basePlayer}
                            isOnline={p.isOnline !== false}
                              isSelf={id === user?.id}
                              isOrganizer={organizerId ? id === organizerId : false}
                              showReady={false}
                              showMetaOverride={true}
                              showTier={false}
                              totalScore={basePlayer?.totalScore ?? p?.totalScore}
                              scoreDisplayOverride={scoreDisplayOverride}
                              scoreTone={deltaTone}
                              animateScore={animateScore}
                              gameScore={typeof p.score === 'number' ? p.score : 0}
                              deltaText=""
                              deltaTone={deltaTone}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div
        className="flex-1 min-h-0 overflow-hidden px-3"
        style={{ paddingTop: topPadding }}
      >
        <div className="flex flex-col h-full min-h-0">
          {phase === PHASES.LOADING ? null : null}

          {!currentQuestion && phase !== PHASES.LOADING && phase !== PHASES.FINISHED ? (
            <LoadingScreen
              fullscreen={false}
              minDuration={400}
              message="Вопрос загружается"
              subtext="Секунду, готовим следующий раунд"
              className="flex-1"
            />
          ) : null}

          {currentQuestion && phase !== PHASES.LOADING ? (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex justify-center" style={{ height: 46 }}>
                <div
                  className={`transition-opacity duration-200 ${phase === PHASES.QUESTION && !hasSubmitted ? 'opacity-100' : 'opacity-0'}`}
                  style={{ pointerEvents: phase === PHASES.QUESTION && !hasSubmitted ? 'auto' : 'none' }}
                >
                  <CountdownRing
                    key={currentQuestion?.id ?? questionIndex}
                    value={timeLeft}
                    max={questionDuration}
                  />
                </div>
              </div>

              <div className="mt-3 text-center text-[20px] leading-[26px] font-extrabold text-[var(--qz-text)]">{statusBadge.text}</div>

              {/* Показываем текст вопроса в фазах QUESTION и REVEAL */}
              {(phase === PHASES.QUESTION || phase === PHASES.REVEAL) && currentQuestion?.text ? (
                <div className="mt-3 text-center text-[17px] leading-[22px] font-semibold text-[var(--qz-text)] whitespace-pre-line">
                  {currentQuestion.text}
                </div>
              ) : null}

              {/* Показываем картинку в фазах QUESTION и REVEAL если она есть */}
              {(phase === PHASES.QUESTION || phase === PHASES.REVEAL) && pictureUrl && !isPlaceholderMedia(pictureUrl) ? (
                <div className="mt-4 relative w-full h-[170px] rounded-[20px] overflow-hidden shrink-0" style={{ backgroundColor: palette.black5 }}>
                  <img
                    src={pictureUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-3">
                {(() => {
                  const indices = optionOrder.map((_, idx) => idx)
                  const displayIndices = isSequence
                    ? [...sequenceOrder, ...indices.filter((i) => !sequenceOrder.includes(i))]
                    : indices

                  const parseCorrectSeq = () => {
                    if (Array.isArray(correctSequence)) return correctSequence
                    if (typeof correctSequence === 'string') {
                      try {
                        const v = JSON.parse(correctSequence)
                        return Array.isArray(v) ? v : []
                      } catch {
                        return []
                      }
                    }
                    return []
                  }
                  const correctSeq = phase === PHASES.REVEAL && isSequence ? parseCorrectSeq() : []

                  return displayIndices.map((displayIndex) => {
                    const opt = optionOrder[displayIndex]
                    const originalIndex = opt.originalIndex

                    if (isSequence) {
                      const pos = sequenceOrder.indexOf(displayIndex)
                      const selected = pos !== -1
                      const orderLabel = selected ? pos + 1 : null

                    let backgroundColor = palette.white
                    let borderColor = palette.black5
                    let borderWidth = 1
                    let color = palette.text

                    let badgeBg = 'transparent'
                    let badgeColor = palette.primary

                    if (phase === PHASES.QUESTION && selected) {
                      if (hasSubmitted) {
                        backgroundColor = palette.primary10
                        borderColor = palette.primary10
                        color = palette.primary
                        badgeBg = palette.primary
                        badgeColor = palette.white
                      } else {
                        borderColor = palette.primary
                        borderWidth = 2
                        color = palette.primary
                        badgeBg = palette.black5
                        badgeColor = palette.primary
                      }
                    }

                    if (phase === PHASES.REVEAL && selected) {
                      const ok = correctSeq[pos] === originalIndex
                      backgroundColor = ok ? palette.success : palette.error
                      borderColor = backgroundColor
                      borderWidth = 0
                      color = palette.white
                      badgeBg = palette.white
                      badgeColor = palette.text
                    }

                      return (
                        <button
                          key={originalIndex}
                          type="button"
                          onClick={() => handleAnswerSelect(displayIndex)}
                          disabled={phase !== PHASES.QUESTION || hasSubmitted || sequenceAnimating}
                          ref={(el) => {
                            if (el) sequenceRowRefs.current.set(displayIndex, el)
                            else sequenceRowRefs.current.delete(displayIndex)
                          }}
                          className="relative w-full h-[56px] rounded-[10px] border flex items-center justify-center px-3 text-[17px] leading-[22px] font-semibold"
                          style={{ backgroundColor, borderColor, borderWidth, color }}
                        >
                          <div
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded-[12px] flex items-center justify-center font-extrabold tabular-nums"
                            style={{
                              backgroundColor: selected ? badgeBg : 'transparent',
                              color: selected ? badgeColor : 'transparent',
                            }}
                          >
                            {orderLabel || ''}
                          </div>
                          <div className="w-full px-[56px] text-center truncate">{opt.text}</div>
                        </button>
                      )
                    }

                    const isSelected = selectedOption === displayIndex
                    const isCorrect = phase === PHASES.REVEAL && correctAnswer === originalIndex
                    const isWrong =
                      phase === PHASES.REVEAL &&
                      hasSubmitted &&
                      submittedOriginalIndex !== null &&
                      submittedOriginalIndex === originalIndex &&
                      !isCorrect

                    let backgroundColor = palette.white
                    let borderColor = palette.black5
                    let borderWidth = 1
                    let color = palette.text

                    if (phase === PHASES.QUESTION && !hasSubmitted && isSelected) {
                      borderColor = palette.primary
                      borderWidth = 2
                      color = palette.primary
                    } else if (phase === PHASES.QUESTION && hasSubmitted && isSelected) {
                      backgroundColor = palette.primary10
                      borderColor = palette.primary10
                      color = palette.primary
                    } else if (phase === PHASES.REVEAL) {
                      if (isCorrect) {
                        backgroundColor = palette.success
                        borderColor = palette.success
                        borderWidth = 0
                        color = palette.white
                      } else if (isWrong) {
                        backgroundColor = palette.error
                        borderColor = palette.error
                        borderWidth = 0
                        color = palette.white
                      }
                    }

                    return (
                      <button
                        key={originalIndex}
                        type="button"
                        onClick={() => handleAnswerSelect(displayIndex)}
                        disabled={phase !== PHASES.QUESTION || hasSubmitted}
                        className="w-full h-[56px] rounded-[10px] border flex items-center justify-center px-4 text-center text-[17px] leading-[22px] font-semibold"
                        style={{ backgroundColor, borderColor, borderWidth, color }}
                      >
                        <span className="break-words">{opt.text}</span>
                      </button>
                    )
                  })
                })()}
              </div>

              <div className="flex-1" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 bg-white px-3" style={{ paddingBottom: bottomPadding }}>
        {phase === PHASES.QUESTION && !hasSubmitted ? (
          <button
            type="button"
            onClick={() => (isSequence ? handleSubmitAnswer(sequenceOrder) : handleSubmitAnswer(selectedOption))}
            disabled={!canSubmit}
            className="w-full h-[50px] rounded-[10px] text-[17px] leading-[22px] font-semibold"
            style={{
              backgroundColor: canSubmit ? palette.primary : palette.black5,
              color: canSubmit ? palette.white : palette.text,
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            Подтвердить
          </button>
        ) : bottomText ? (
          <div className="h-[50px] flex items-center justify-center text-[17px] leading-[22px] font-semibold text-[var(--qz-text)]">
            {bottomText}
          </div>
        ) : null}
      </div>

      {false && scoreOverlay.visible && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${scoreOverlay.hiding ? 'opacity-0' : 'opacity-100'
            }`}
          aria-live="polite"
        >
          <div className="absolute inset-0" style={{ backgroundColor: palette.black50 }} />
          <div className="relative w-full max-w-[420px] card glass-card shadow-2xl border border-base-300/60 overflow-x-hidden overflow-y-visible">
            <div className="absolute -top-4 left-6 px-4 py-2 rounded-full text-sm font-bold uppercase pointer-pass" style={{ backgroundColor: palette.yellow, color: palette.black }}>
              Счёт
            </div>
            <div className="card-body pt-12 space-y-4">
              <div
                className={`grid gap-2 sm:gap-3 w-full px-2 overflow-x-hidden ${overlayScrollable ? 'max-h-[70vh] overflow-y-auto pr-1' : ''
                  }`}
              >
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
                      className={`box-border flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 rounded-xl bg-base-200 border w-full max-w-full min-w-0 ${!p.isOnline ? 'opacity-60 grayscale' : ''}`}
                      style={{ borderColor: isSelf ? palette.yellow : palette.primary }}
                    >
                      <span className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg tabular-nums" style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${palette.primary}` }}>
                        {idx + 1}
                      </span>
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
                      <div className="relative min-w-[96px] sm:min-w-[120px] flex items-center justify-end">
                        {scoreOverlay.step === 'updated' && delta > 0 ? (
                          <div key={`${id}:${delta}:${scoreOverlay.step}`} className="quizzy-float-up text-sm font-black tabular-nums" style={{ color: palette.success }}>
                            +{delta}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none"
                            style={{ color: isChanged && scoreOverlay.step !== 'before' ? palette.success : palette.yellow }}
                          >
                            {p.score || 0}
                          </div>
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

      {false && !currentQuestion && phase !== PHASES.LOADING && phase !== PHASES.FINISHED && (
        <div className="card glass-card shadow-2xl border border-base-300/60 w-full max-w-[600px] mx-auto mt-3">
          <div className="card-body text-center py-16">
            <div className="text-2xl font-black">Вопрос загружается</div>
            <div className="opacity-70 mt-2">Подождите пару секунд...</div>
          </div>
        </div>
      )}
      {false && currentQuestion && phase !== PHASES.LOADING && (
        <div className="card glass-card shadow-2xl border border-base-300/60 w-full max-w-[600px] mx-auto relative overflow-visible mt-3">
          <div className="absolute -top-3 left-4 flex flex-wrap gap-2 pointer-pass">
            <div className="px-3 py-1 rounded-full text-xs font-bold uppercase pointer-pass" style={{ backgroundColor: palette.yellow, color: palette.black }}>
              {statusBadge.text}
            </div>
            {difficultyChip && (
              <div className={`badge gap-2 p-3 rounded-xl font-bold ${difficultyChip.color}`}>{difficultyChip.label}</div>
            )}
          </div>
          <div className="card-body pt-8">
            {totalPhaseTime > 0 && (
              <div className="relative mb-4 px-2">
                <div className="relative h-2 rounded-full bg-base-300 overflow-hidden">
                  <div
                    key={barKey}
                    className="absolute inset-0 rounded-full progress-bar-fill"
                    style={{ animationDuration: `${totalPhaseTime}s` }}
                  />
                </div>
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
                          className="absolute left-3 bottom-3 px-3 py-2 rounded-xl text-white text-sm flex items-center gap-3 pointer-events-auto"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          style={{ backgroundColor: palette.black50 }}
                        >
                          <button
                            type="button"
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            onClick={() => setMediaMuted((v) => !v)}
                            title={mediaMuted ? 'Включить звук' : 'Выключить звук'}
                            style={{ backgroundColor: palette.black50 }}
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
                        <div className="absolute right-3 bottom-3 px-3 py-2 rounded-xl text-white text-sm flex items-center gap-2 pointer-events-none" style={{ backgroundColor: palette.black50 }}>
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
              <div className="grid gap-3 mt-4 md:grid-cols-2">
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
                  const showPrimaryBg = hasSubmitted && isSelected && !isWrongSelection && phase !== PHASES.REVEAL
                  const baseBg = 'var(--quizzy-option-bg)'
                  const baseText = 'var(--quizzy-option-text)'
                  const correctBg = 'var(--quizzy-success)'
                  const wrongBg = 'var(--quizzy-danger)'
                  const selectedBg = showPrimaryBg ? 'var(--quizzy-primary)' : baseBg
                  const selectedText = showPrimaryBg ? 'var(--quizzy-btn-primary-fg)' : baseText

                  let background = selectedBg
                  let color = selectedText
                  let borderColor = 'transparent'
                if (phase === PHASES.REVEAL) {
                  if (isCorrectOpt) {
                    background = correctBg
                    color = palette.white
                  } else if (isWrongSelection) {
                    background = wrongBg
                    color = palette.white
                  } else if (isSelected) {
                    background = 'var(--quizzy-primary)'
                    color = 'var(--quizzy-btn-primary-fg)'
                  }
                } else if (isSelected) {
                    borderColor = 'var(--quizzy-primary)'
                  }

                  return (
                    <div
                      key={idx}
                      className="answer-option relative w-full text-left px-4 py-3 rounded-2xl border"
                      style={{
                        background,
                        color,
                        borderColor: borderColor !== 'transparent' ? borderColor : 'transparent',
                        '--answer-correct-bg': correctBg,
                      }}
                      onClick={() => handleAnswerSelect(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleAnswerSelect(idx)
                      }}
                    >
                      <span className="font-semibold mr-2">{getOptionLetter(idx)}.</span>
                      <span className="break-words">{opt.text}</span>
                      {currentQuestion?.type === 'sequence' ? (
                        <span
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold tabular-nums"
                          style={{
                            background:
                              hasSubmitted && phase !== PHASES.REVEAL
                                ? 'var(--quizzy-secondary)'
                                : isSelected && phase !== PHASES.REVEAL
                                  ? 'var(--quizzy-primary)'
                                  : 'transparent',
                            color:
                              hasSubmitted && phase !== PHASES.REVEAL
                                ? 'var(--quizzy-btn-secondary-fg)'
                                : isSelected && phase !== PHASES.REVEAL
                                  ? 'var(--quizzy-btn-primary-fg)'
                                  : color,
                            border: `2px solid ${hasSubmitted && phase !== PHASES.REVEAL
                              ? 'var(--quizzy-secondary)'
                              : isSelected && phase !== PHASES.REVEAL
                                ? 'var(--quizzy-primary)'
                                : 'rgba(255,255,255,0.25)'
                              }`,
                          }}
                        >
                          {isSelected ? sequenceOrder[idx] ?? '' : ''}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {false && currentQuestion && (
        <div className="w-full max-w-[600px] mx-auto">
          {(() => {
            const base = 'w-full h-14 text-base font-semibold rounded-xl flex items-center justify-center transition-colors'
            const isSequence = currentQuestion?.type === 'sequence'
            const filledCount = sequenceOrder.filter((v) => v !== null && v !== undefined).length
            const selectionComplete = isSequence
              ? options.length > 0 && sequenceOrder.length === options.length
              : selectedOption !== null && selectedOption !== undefined; const canSubmit = phase === PHASES.QUESTION && !hasSubmitted && selectionComplete
            const styles = hasSubmitted
              ? { backgroundColor: palette.success, borderColor: palette.success } // green
              : selectionComplete
                ? { backgroundColor: palette.primary, borderColor: palette.primary } // blue
                : { backgroundColor: palette.muted, borderColor: palette.muted } // gray
            const buttonLabel = hasSubmitted
              ? 'Подтверждено'
              : selectionComplete
                ? 'Подтвердить'
                : 'Сделай выбор'
            return (
              <div className="w-full max-w-[520px] mx-auto">
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
              </div>
            )
          })()}
        </div>
      )}

      {false && features?.playersListInGame && players.length > 0 && phase !== PHASES.FINISHED && (
        <div className="card glass-card shadow-xl border border-base-300/60 w-full max-w-[420px] mx-auto relative overflow-x-hidden overflow-y-visible">
          <div className="absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase pointer-pass" style={{ backgroundColor: palette.yellow, color: palette.black }}>
            Игроки: {players.length}
          </div>
          <div className="card-body pt-8 space-y-3">
            <div className="grid gap-2 pr-1 max-h-[360px] overflow-y-auto overflow-x-hidden scroll-mask w-full">
              {[...players]
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, idx) => {
                  const isSelf = p.player.id === user.id
                  const answered = p.currentAnswer !== null && p.currentAnswer !== undefined
                  const isHost = organizerId && p.player.id === organizerId
                  return (
                    <div
                      key={p.player.id}
                      className={`box-border flex items-center gap-3 px-3 py-3 rounded-lg bg-base-200 border w-full max-w-full min-w-0 ${!p.isOnline ? 'opacity-60 grayscale' : ''}`}
                      style={{ borderColor: isSelf ? palette.yellow : palette.primary }}
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
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs" style={{ color: palette.yellow }}>★</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {p.player.username || p.player.firstName || 'Игрок'}
                        </div>
                        <div className="text-sm flex items-center gap-1" style={{ color: palette.yellow }}>
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

