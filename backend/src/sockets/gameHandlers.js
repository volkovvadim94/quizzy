import pkg from '@prisma/client'
import jwt from 'jsonwebtoken'
import { withMediaPlaceholders } from '../utils/media.js'
import { deleteRoomState, ensurePlayer, getRoomState, listRooms, resetAnswers, roomToPublic } from '../utils/roomStore.js'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_SCORE,
  QUESTIONS_PER_GAME,
  RANDOM_DISTRIBUTION,
  QUESTION_TIME_MS,
  RECONNECT_GRACE_MS,
  REVEAL_TIME_MS,
} from '../utils/constants.js'

const { PrismaClient } = pkg
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'quizzy-secret-key'

// telegramId -> { clientSessionId, sockets:Set<string> }
const activeTelegramSessions = new Map()


const findActiveRoomHintForUser = (userId) => {
  try {
    const rooms = listRooms()
    const owned = rooms.find((r) => r.organizerId === userId && r.status !== 'finished')
    if (owned) return owned.id
    const member = rooms.find((r) => r.players?.has?.(userId) && r.status !== 'finished')
    return member?.id || null
  } catch {
    return null
  }
}

const questionTimers = new Map() // gameId -> timeout

const parseBool = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return defaultValue
}

const logSockets = () => parseBool(process.env.LOG_SOCKETS, process.env.NODE_ENV !== 'production')
const logRooms = () => parseBool(process.env.LOG_ROOMS, process.env.NODE_ENV !== 'production')

const logEvent = (tag, data = {}) => {
  const enabled =
    tag.startsWith('socket') || tag.startsWith('session') ? logSockets() : tag.startsWith('room') ? logRooms() : false
  if (!enabled) return
  try {
    console.log(`[${new Date().toISOString()}] ${tag}`, data)
  } catch {
    // ignore
  }
}

const featureDifficultySelection = () =>
  parseBool(process.env.FEATURE_DIFFICULTY_SELECTION, false) ||
  // Backward-compat: older env name used in some setups
  parseBool(process.env.FEATURE_QUESTION_RATING, false)

const debugSessions = () => parseBool(process.env.DEBUG_SESSIONS, false)

const labelFromPreset = (preset) => DIFFICULTY_LABELS[preset] || 'medium'

const randomInt = (max) => Math.floor(Math.random() * max)

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

const normalizePlayerId = (value) => {
  if (value === undefined || value === null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  const int = Math.trunc(n)
  if (int <= 0) return null
  return int
}

const normalizeClientSessionId = (value) => {
  if (value === undefined || value === null) return null
  const v = String(value).trim()
  if (!v) return null
  return v.slice(0, 120)
}

const rejectAsTakenOver = (socket, gameId, playerId) => {
  try {
    socket.emit('SESSION_TAKEN_OVER', { gameId, playerId })
  } catch {
    // ignore
  }
  try {
    socket.disconnect(true)
  } catch {
    // ignore
  }
}

const getAuthorizedPlayerEntry = (room, socket, gameId, explicitPlayerId = null) => {
  const pid = explicitPlayerId ?? socket.data?.playerId
  const entry = pid ? room.players.get(pid) : null
  if (!pid || !entry) return null

  const sid = socket.data?.clientSessionId
  if (sid && entry.clientSessionId && sid !== entry.clientSessionId) {
    rejectAsTakenOver(socket, gameId, pid)
    return null
  }

  if (entry.sockets && !entry.sockets.has(socket.id)) {
    rejectAsTakenOver(socket, gameId, pid)
    return null
  }

  return entry
}

const disconnectSocketIds = (io, socketIds, payloadBase) => {
  for (const sid of socketIds) {
    const s = io.sockets.sockets.get(sid)
    if (!s) continue

    const gid = payloadBase?.gameId ?? s.data?.gameId ?? null
    const payload = gid ? { ...payloadBase, gameId: gid } : { ...payloadBase }

    try {
      s.emit('SESSION_TAKEN_OVER', payload)
    } catch {
      // ignore
    }
    setTimeout(() => {
      try {
        s.disconnect(true)
      } catch {
        // ignore
      }
    }, 800)
  }
}

const parseOptions = (options) => {
  if (Array.isArray(options)) return options
  try {
    return JSON.parse(options || '[]')
  } catch {
    return []
  }
}

const toPublicQuestion = (question) => {
  const opts = parseOptions(question.options)
  const q = withMediaPlaceholders({ ...question, options: opts })
  const { correctOption, correctSequence, ...rest } = q
  return rest
}

const pickQuestionsRandom = (all) => {
  const buckets = {
    easy: [],
    medium: [],
    hard: [],
    hardcore: [],
  }
  all.forEach((q) => {
    buckets[labelFromPreset(q.difficultyPreset)].push(q)
  })

  const counts = {}
  let used = 0
  const weights = RANDOM_DISTRIBUTION
  // первичный расчёт
  for (const [k, w] of Object.entries(weights)) {
    const c = Math.round(w * QUESTIONS_PER_GAME)
    counts[k] = c
    used += c
  }
  // добиваем до 10 за счёт medium -> hard -> easy
  const order = ['medium', 'hard', 'easy', 'hardcore']
  while (used < QUESTIONS_PER_GAME) {
    const key = order[used % order.length]
    counts[key] = (counts[key] || 0) + 1
    used += 1
  }
  while (used > QUESTIONS_PER_GAME) {
    const key = order[used % order.length]
    if (counts[key] > 0) {
      counts[key] -= 1
      used -= 1
    } else {
      break
    }
  }

  const picked = []
  for (const key of Object.keys(counts)) {
    const pool = shuffle(buckets[key])
    picked.push(...pool.slice(0, counts[key]))
  }
  // если где-то не хватило, добираем любыми (с повторениями при малом пуле)
  while (picked.length < QUESTIONS_PER_GAME) {
    const remaining = shuffle(all)
    if (remaining.length === 0) break
    picked.push(...remaining.slice(0, Math.min(QUESTIONS_PER_GAME - picked.length, remaining.length)))
    if (remaining.length === 1) {
      // при совсем маленьком наборе разрешаем повтор одного вопроса
      while (picked.length < QUESTIONS_PER_GAME) picked.push(remaining[0])
    }
  }

  return shuffle(picked).slice(0, QUESTIONS_PER_GAME)
}

const pickQuestionsPreset = (all, difficulty) => {
  const filtered = shuffle(all.filter((q) => labelFromPreset(q.difficultyPreset) === difficulty))
  if (filtered.length >= QUESTIONS_PER_GAME) return filtered.slice(0, QUESTIONS_PER_GAME)
  const need = QUESTIONS_PER_GAME - filtered.length
  const fallback = shuffle(all)
  const picked = [...filtered]
  while (picked.length < QUESTIONS_PER_GAME && fallback.length > 0) {
    picked.push(fallback.shift())
  }
  // если всё ещё меньше — разрешаем повторы из исходного списка
  if (picked.length < QUESTIONS_PER_GAME && all.length > 0) {
    while (picked.length < QUESTIONS_PER_GAME) {
      picked.push(all[picked.length % all.length])
    }
  }
  return picked.slice(0, QUESTIONS_PER_GAME)
}

const buildQuestions = async (room) => {
  const all = await prisma.question.findMany({
    where: { topicId: room.topicId },
    orderBy: { createdAt: 'desc' },
  })
  const withParsed = all.map((q) => ({ ...q, options: parseOptions(q.options) }))

  if (!featureDifficultySelection() || room.difficulty === 'random') {
    return pickQuestionsRandom(withParsed)
  }
  return pickQuestionsPreset(withParsed, room.difficulty)
}

const calcScore = (question) => {
  const label = labelFromPreset(question.difficultyPreset)
  return DIFFICULTY_SCORE[label] ?? DIFFICULTY_SCORE.medium
}

const isAnswerCorrect = (question, payload) => {
  if (question.type === 'sequence') {
    const correctSeq = Array.isArray(question.correctSequence)
      ? question.correctSequence
      : JSON.parse(question.correctSequence || '[]')
    const given = Array.isArray(payload?.sequence) ? payload.sequence : []
    if (correctSeq.length !== given.length) return false
    return correctSeq.every((v, idx) => Number(v) === Number(given[idx]))
  }
  return question.correctOption === payload?.answerIndex
}

const clearQuestionTimer = (gameId) => {
  const t = questionTimers.get(gameId)
  if (t) {
    clearTimeout(t)
    questionTimers.delete(gameId)
  }
}

const emitGameState = async (io, room) => {
  const userIds = Array.from(room.players.keys())
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      totalScore: true,
    },
  })
  const byId = Object.fromEntries(users.map((u) => [u.id, u]))
  io.to(room.id).emit('GAME_STATE', roomToPublic(room, byId))
}

const sendQuestion = (io, room, index) => {
  const question = room.questions[index]
  if (!question) return
  io.to(room.id).emit('NEW_QUESTION', {
    question: toPublicQuestion(question),
    questionIndex: index,
    totalQuestions: room.totalQuestions || room.questions.length || QUESTIONS_PER_GAME,
    questionTimeMs: QUESTION_TIME_MS,
    revealTimeMs: REVEAL_TIME_MS,
  })
}

const updateScores = async (room, question) => {
  const delta = calcScore(question)
  room.players.forEach((p) => {
    if (p.isCorrect) {
      p.score += delta
    }
  })
}

const persistRoomStart = async (room) => {
  try {
    await prisma.room.create({
      data: {
        id: room.id,
        topicId: room.topicId,
        difficulty: room.difficulty,
        questionsIdsJson: JSON.stringify(room.questions.map((q) => q.id)),
        playersIdsJson: JSON.stringify(Array.from(room.players.keys())),
        status: 'active',
        createdAt: room.createdAt,
      },
    })
  } catch (e) {
    console.warn('Persist room start failed', e?.message)
  }
}

const persistRoomFinish = async (room) => {
  try {
    await prisma.room.update({
      where: { id: room.id },
      data: {
        playersIdsJson: JSON.stringify(Array.from(room.players.keys())),
        status: 'finished',
        finishedAt: room.finishedAt || new Date(),
      },
    })
  } catch (e) {
    console.warn('Persist room finish failed', e?.message)
  }
}

const applyTopicScores = async (room) => {
  const topicId = room.topicId
  const ops = []
  for (const player of room.players.values()) {
    ops.push(
      prisma.userTopicScore.upsert({
        where: { userId_topicId: { userId: player.playerId, topicId } },
        create: { userId: player.playerId, topicId, score: player.score },
        update: { score: { increment: player.score } },
      })
    )
  }
  await prisma.$transaction(ops)

  // Пересчитываем totalScore как сумму по темам
  const userIds = Array.from(room.players.keys())
  for (const uid of userIds) {
    const agg = await prisma.userTopicScore.aggregate({
      where: { userId: uid },
      _sum: { score: true },
    })
    await prisma.user.update({
      where: { id: uid },
      data: { totalScore: agg._sum.score || 0 },
    })
  }
}

const finishGame = async (io, room) => {
  clearQuestionTimer(room.id)
  room.status = 'finished'
  room.finishedAt = new Date()
  await persistRoomFinish(room)
  await applyTopicScores(room)
  logEvent('room.game.finish', { gameId: room.id, finishedAt: room.finishedAt?.toISOString?.() })

  const userIds = Array.from(room.players.keys())
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, totalScore: true },
  })
  const byId = Object.fromEntries(users.map((u) => [u.id, u]))
  const leaderboard = Array.from(room.players.values())
    .map((p) => ({
      ...p,
      player: byId[p.playerId] || { id: p.playerId },
    }))
    .sort((a, b) => b.score - a.score)

  io.to(room.id).emit('GAME_FINISHED', { leaderboard })
}

const endQuestion = async (io, room) => {
  if (room.status === 'finished') return
  clearQuestionTimer(room.id)
  const qIdx = room.currentQuestion
  const question = room.questions[qIdx]
  if (!question) return

  await updateScores(room, question)
  await emitGameState(io, room)
  let correctSeq = null
  if (question.type === 'sequence') {
    try {
      correctSeq = Array.isArray(question.correctSequence)
        ? question.correctSequence
        : JSON.parse(question.correctSequence || '[]')
    } catch {
      correctSeq = null
    }
  }
  io.to(room.id).emit('QUESTION_ENDED', {
    correctAnswer: question.correctOption,
    correctSequence: correctSeq,
  })

  const proceed = async () => {
    if (room.status === 'finished') return
    const nextIndex = qIdx + 1
    const total = room.totalQuestions || room.questions.length || QUESTIONS_PER_GAME
    if (nextIndex < total && nextIndex < room.questions.length) {
      room.currentQuestion = nextIndex
      resetAnswers(room)
      sendQuestion(io, room, nextIndex)
      const t = setTimeout(() => endQuestion(io, room), QUESTION_TIME_MS)
      questionTimers.set(room.id, t)
    } else {
      await finishGame(io, room)
    }
  }

  setTimeout(proceed, REVEAL_TIME_MS)
}

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    logEvent('socket.connect', {
      socketId: socket.id,
      transport: socket?.conn?.transport?.name,
      address: socket?.handshake?.address,
    })

    socket.on('AUTH', ({ token, clientSessionId } = {}) => {
      try {
        const sid = normalizeClientSessionId(clientSessionId)
        if (!token || !sid) return socket.emit('ERROR', { message: 'Missing auth' })

        let payload = null
        try {
          payload = jwt.verify(token, JWT_SECRET)
        } catch {
          return socket.emit('ERROR', { message: 'Invalid token' })
        }

        const telegramId = payload?.telegramId ? String(payload.telegramId) : null
        const userId = normalizePlayerId(payload?.id)
        if (!telegramId || !userId) return socket.emit('ERROR', { message: 'Invalid token payload' })

        const existing = activeTelegramSessions.get(telegramId)
        const alreadyAuthed =
          socket.data.telegramId === telegramId &&
          socket.data.authUserId === userId &&
          socket.data.clientSessionId === sid &&
          existing?.clientSessionId === sid &&
          existing?.sockets?.has?.(socket.id)

        if (alreadyAuthed) {
          socket.emit('AUTH_OK', { userId })
          const roomHint = findActiveRoomHintForUser(userId)
          if (roomHint) {
            const room = getRoomState(roomHint)
            socket.emit('ACTIVE_GAME', { gameId: roomHint, status: room?.status || null })
          }
          return
        }

        socket.data.telegramId = telegramId
        socket.data.authUserId = userId
        socket.data.clientSessionId = sid

        if (existing && existing.clientSessionId && existing.clientSessionId !== sid) {
          logEvent('session.takeover', {
            telegramId,
            userId,
            fromSessionId: existing.clientSessionId,
            toSessionId: sid,
            oldSockets: existing.sockets?.size || 0,
          })
          const oldSocketIds = Array.from(existing.sockets || [])
          const roomHint = findActiveRoomHintForUser(userId)
          existing.sockets?.clear?.()
          existing.clientSessionId = sid
          existing.sockets = existing.sockets || new Set()
          existing.sockets.add(socket.id)
          disconnectSocketIds(io, oldSocketIds, { playerId: userId, gameId: roomHint || null })
        } else {
          const entry = existing || { clientSessionId: sid, sockets: new Set() }
          entry.clientSessionId = sid
          entry.sockets.add(socket.id)
          activeTelegramSessions.set(telegramId, entry)
        }

        if (debugSessions()) {
          console.log('[sessions] AUTH', {
            telegramId,
            userId,
            sid,
            sockets: activeTelegramSessions.get(telegramId)?.sockets?.size || 0,
          })
        }

        logEvent('session.auth', {
          socketId: socket.id,
          telegramId,
          userId,
          sessionId: sid,
          sockets: activeTelegramSessions.get(telegramId)?.sockets?.size || 0,
        })

        socket.emit('AUTH_OK', { userId })
        const roomHint = findActiveRoomHintForUser(userId)
        if (roomHint) {
          const room = getRoomState(roomHint)
          socket.emit('ACTIVE_GAME', { gameId: roomHint, status: room?.status || null })
        }
      } catch (e) {
        console.error('AUTH error:', e)
        socket.emit('ERROR', { message: 'Auth failed' })
      }
    })

    socket.on('JOIN_GAME', async ({ gameId, playerId, player, clientSessionId }) => {
      try {
        const room = getRoomState(gameId)
        if (!room) return socket.emit('ERROR', { message: 'Комната не найдена' })
        const pid = normalizePlayerId(socket.data?.authUserId ?? playerId ?? player?.id)
        const user = pid ? await prisma.user.findUnique({ where: { id: pid } }) : null
        if (!user) return socket.emit('ERROR', { message: 'Пользователь не найден' })

        const sid = normalizeClientSessionId(clientSessionId)
        if (!sid) return socket.emit('ERROR', { message: 'Missing clientSessionId' })

        socket.join(gameId)
        socket.data.gameId = gameId
        socket.data.playerId = pid
        socket.data.clientSessionId = sid

        const entry = ensurePlayer(room, pid)
        if (entry.disconnectTimer) {
          clearTimeout(entry.disconnectTimer)
          entry.disconnectTimer = null
        }
        entry.disconnectedAt = null
        const prevSid = entry.clientSessionId
        if (debugSessions()) {
          console.log('[sessions] JOIN_GAME', {
            gameId,
            playerId: pid,
            sid,
            prevSid,
            sockets: entry.sockets?.size || 0,
          })
        }

        if (prevSid && prevSid !== sid) {
          logEvent('session.takeover.room', { gameId, playerId: pid, fromSessionId: prevSid, toSessionId: sid })
          const oldSocketIds = Array.from(entry.sockets || [])
          entry.sockets?.clear?.()
          entry.clientSessionId = sid
          entry.sockets.add(socket.id)

          for (const oldId of oldSocketIds) {
            const oldSocket = io.sockets.sockets.get(oldId)
            if (!oldSocket) continue
            try {
              oldSocket.emit('SESSION_TAKEN_OVER', { gameId, playerId: pid })
            } catch {
              // ignore
            }
            setTimeout(() => {
              try {
                oldSocket.disconnect(true)
              } catch {
                // ignore
              }
            }, 800)
          }
        } else {
          if (!prevSid) entry.clientSessionId = sid
          entry.sockets.add(socket.id)
        }

        await emitGameState(io, room)

        logEvent('room.join', { gameId, playerId: pid, sockets: entry.sockets?.size || 0, status: room.status })

        if (room.status === 'active') {
          sendQuestion(io, room, room.currentQuestion)
        } else if (room.status === 'finished') {
          socket.emit('GAME_FINISHED', { leaderboard: [] })
        }
      } catch (error) {
        console.error('Join game error:', error)
        socket.emit('ERROR', { message: 'Не удалось присоединиться' })
      }
    })

    socket.on('PLAYER_READY', async ({ gameId, playerId, isReady }) => {
      const room = getRoomState(gameId)
      if (!room) return socket.emit('ERROR', { message: 'Комната не найдена' })
      const pid = normalizePlayerId(socket.data?.playerId ?? playerId)
      if (!pid) return socket.emit('ERROR', { message: 'Missing playerId' })
      const entry = getAuthorizedPlayerEntry(room, socket, gameId, pid)
      if (!entry) return
      entry.isReady = !!isReady
      await emitGameState(io, room)
    })

    socket.on('START_GAME', async ({ gameId }) => {
      try {
        const room = getRoomState(gameId)
        if (!room) return socket.emit('ERROR', { message: 'Комната не найдена' })
        if (room.status !== 'waiting') return

        const pid = normalizePlayerId(socket.data?.playerId)
        if (!pid) return socket.emit('ERROR', { message: "Missing playerId" })
        const entry = getAuthorizedPlayerEntry(room, socket, gameId, pid)
        if (!entry) return
        if (room.organizerId !== pid) return socket.emit('ERROR', { message: 'Only organizer can start' })

        room.questions = await buildQuestions(room)
        room.questionsIds = room.questions.map((q) => q.id)
        room.totalQuestions = room.questions.length || QUESTIONS_PER_GAME
        room.status = 'active'
        room.startedAt = new Date()
        room.currentQuestion = 0
        resetAnswers(room)

        await persistRoomStart(room)
        io.to(gameId).emit('GAME_STARTED')
        logEvent('room.game.start', { gameId, topicId: room.topicId, difficulty: room.difficulty })
        sendQuestion(io, room, 0)
        const t = setTimeout(() => endQuestion(io, room), QUESTION_TIME_MS)
        questionTimers.set(gameId, t)
        await emitGameState(io, room)
      } catch (error) {
        console.error('Start game error:', error)
        socket.emit('ERROR', { message: 'Не удалось начать игру' })
      }
    })

    socket.on('SUBMIT_ANSWER', async ({ gameId, questionId, answerIndex, sequence, playerId }) => {
      try {
        const room = getRoomState(gameId)
        if (!room) return socket.emit('ERROR', { message: 'Комната не найдена' })
        const pid = normalizePlayerId(socket.data?.playerId ?? playerId)
        if (!pid) return socket.emit('ERROR', { message: 'Нет playerId' })
        const player = getAuthorizedPlayerEntry(room, socket, gameId, pid)
        if (!player) return

        const currentQuestion = room.questions[room.currentQuestion]
        if (!currentQuestion || currentQuestion.id !== questionId) return

        const correct = isAnswerCorrect(currentQuestion, { answerIndex, sequence })
        player.currentAnswer = sequence ?? answerIndex
        player.isCorrect = correct

        await emitGameState(io, room)

        const allAnswered = Array.from(room.players.values()).every(
          (p) => p.currentAnswer !== null && p.currentAnswer !== undefined
        )
        if (allAnswered) {
          await endQuestion(io, room)
        }

        socket.emit('ANSWER_RECEIVED', { isCorrect: correct })
      } catch (error) {
        console.error('Submit answer error:', error)
        socket.emit('ERROR', { message: 'Не удалось принять ответ' })
      }
    })

    socket.on('LEAVE_GAME', async ({ gameId, playerId }) => {
      try {
        const room = getRoomState(gameId)
        if (!room) return
        const pid = normalizePlayerId(socket.data?.playerId ?? playerId)
        const entry = room.players.get(pid)
        if (entry?.sockets) entry.sockets.delete(socket.id)

        const removed = entry && (!entry.sockets || entry.sockets.size === 0)
        if (removed) room.players.delete(pid)

        logEvent('room.leave', { gameId, playerId: pid, removed, playersLeft: room.players.size })

        try {
          socket.leave(gameId)
          if (socket.data?.gameId === gameId) socket.data.gameId = null
        } catch {
          // ignore
        }

        if (removed && room.organizerId === pid) {
          const first = room.players.values().next().value
          room.organizerId = first?.playerId || null
        }
        if (room.players.size === 0) {
          clearQuestionTimer(gameId)
          deleteRoomState(gameId)
          io.to(gameId).emit('GAME_CLOSED')
          logEvent('room.closed', { gameId, reason: 'no_players' })
          return
        }
        await emitGameState(io, room)
      } catch (error) {
        console.error('Leave game error:', error)
      }
    })

    socket.on('JOIN_SPECTATOR', ({ spectateToken }) => {
      const room = getRoomState(spectateToken)
      if (!room) {
        socket.emit('ERROR', { message: 'Комната не найдена' })
        return
      }
      socket.join(room.id)
      socket.data.spectateGameId = room.id
      emitGameState(io, room)
      if (room.status === 'active') {
        sendQuestion(io, room, room.currentQuestion)
      } else if (room.status === 'finished') {
        socket.emit('GAME_FINISHED', { leaderboard: [] })
      }
    })

    socket.on('disconnect', async (reason) => {
      const { gameId, playerId, telegramId } = socket.data || {}

      logEvent('socket.disconnect', {
        socketId: socket.id,
        reason: reason || null,
        gameId: gameId || null,
        playerId: playerId || null,
        telegramId: telegramId || null,
      })

      if (telegramId) {
        const s = activeTelegramSessions.get(String(telegramId))
        if (s?.sockets) {
          s.sockets.delete(socket.id)
          if (s.sockets.size === 0) activeTelegramSessions.delete(String(telegramId))
        }
      }

      if (!gameId || !playerId) return
      const room = getRoomState(gameId)
      if (!room) return
      const entry = room.players.get(playerId)
      if (entry?.sockets) {
        entry.sockets.delete(socket.id)
      }

      if (entry && (!entry.sockets || entry.sockets.size === 0)) {
        entry.disconnectedAt = Date.now()
        if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)

        // If organizer went offline, transfer host immediately to any online player.
        if (room.organizerId === playerId) {
          const nextHost = Array.from(room.players.values()).find((p) => p.playerId !== playerId && p.sockets?.size > 0)
          room.organizerId = nextHost?.playerId || room.organizerId
        }

        logEvent('room.player.offline', { gameId, playerId, organizerId: room.organizerId })

        entry.disconnectTimer = setTimeout(async () => {
          const r = getRoomState(gameId)
          if (!r) return
          const e = r.players.get(playerId)
          if (!e) return
          if (e.sockets && e.sockets.size > 0) return
          // still offline after grace period => remove from room
          r.players.delete(playerId)
          logEvent('room.player.kicked', { gameId, playerId, reason: 'reconnect_timeout' })
          if (r.organizerId === playerId) {
            const first = r.players.values().next().value
            r.organizerId = first?.playerId || null
          }
          if (r.players.size === 0) {
            clearQuestionTimer(gameId)
            deleteRoomState(gameId)
            io.to(gameId).emit('GAME_CLOSED')
            logEvent('room.closed', { gameId, reason: 'no_players' })
            return
          }
          await emitGameState(io, r)
        }, RECONNECT_GRACE_MS)
      }

      await emitGameState(io, room)
    })
  })
}
