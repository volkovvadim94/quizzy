import { QUESTIONS_PER_GAME } from './constants.js'

const rooms = new Map()
const botTotalScores = new Map() // botId -> totalScore (in-memory)

export const bumpBotTotalScore = (botId, delta = 0) => {
  const id = typeof botId === 'number' ? botId : Number(botId)
  if (!Number.isFinite(id)) return 0
  const prev = botTotalScores.get(id) || 0
  const next = prev + (Number(delta) || 0)
  botTotalScores.set(id, next)
  return next
}

export const getBotTotalScore = (botId) => {
  const id = typeof botId === 'number' ? botId : Number(botId)
  if (!Number.isFinite(id)) return 0
  return botTotalScores.get(id) || 0
}

export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export const createRoomState = ({ id, topicId, topicName, difficulty, organizerId }) => {
  const room = {
    id,
    spectateToken: id,
    topicId,
    topicName,
    organizerId,
    difficulty,
    status: 'waiting',
    createdAt: new Date(),
    lastActivityAt: new Date(),
    currentQuestion: 0,
    questions: [],
    questionOptionOrders: new Map(), // questionId -> [originalIndexByDisplayIndex]
    players: new Map(),
    hasBots: false,
    botIds: [],
    questionsIds: [],
    startedAt: null,
    finishedAt: null,
    totalQuestions: QUESTIONS_PER_GAME,
  }
  rooms.set(id, room)
  // Initialize organizer
  room.players.set(organizerId, {
    playerId: organizerId,
    score: 0,
    currentAnswer: null,
    isCorrect: null,
    isReady: false,
    clientSessionId: null,
    disconnectedAt: null,
    disconnectTimer: null,
    sockets: new Set(),
    isBot: false,
  })
  return room
}

export const getRoomState = (id) => rooms.get(id)

export const deleteRoomState = (id) => rooms.delete(id)

export const listRooms = () => Array.from(rooms.values())

export const touchRoom = (room) => {
  if (!room) return
  room.lastActivityAt = new Date()
}

export const ensurePlayer = (room, playerId) => {
  if (!room.players.has(playerId)) {
    room.players.set(playerId, {
      playerId,
      score: 0,
      currentAnswer: null,
      isCorrect: null,
      isReady: false,
      clientSessionId: null,
      disconnectedAt: null,
      disconnectTimer: null,
      sockets: new Set(),
      isBot: false,
    })
  }
  return room.players.get(playerId)
}

export const addBotsToRoom = (room, { count = 10 } = {}) => {
  if (!room || room.hasBots) return room
  const existing = new Set(room.players.keys())
  const botIds = []
  for (let i = 0; i < count; i += 1) {
    const id = -(i + 1)
    if (existing.has(id)) continue
    existing.add(id)
    botIds.push(id)
    room.players.set(id, {
      playerId: id,
      score: 0,
      currentAnswer: null,
      isCorrect: null,
      isReady: true,
      clientSessionId: null,
      disconnectedAt: null,
      disconnectTimer: null,
      sockets: new Set(),
      isBot: true,
      botProfile: {
        id,
        username: `Bot_${i + 1}`,
        firstName: `Bot ${i + 1}`,
        lastName: null,
        avatarUrl: null,
        totalScore: getBotTotalScore(id),
      },
    })
  }
  room.hasBots = true
  room.botIds = botIds
  return room
}

export const resetAnswers = (room) => {
  room.players.forEach((p) => {
    p.currentAnswer = null
    p.isCorrect = null
  })
}

export const roomToPublic = (room, usersById) => {
  const players = Array.from(room.players.values()).map((p) => ({
    playerId: p.playerId,
    score: p.score,
    currentAnswer: p.currentAnswer,
    isCorrect: p.isCorrect,
    isReady: p.isReady,
    player: usersById[p.playerId] || p.botProfile || { id: p.playerId },
    isBot: !!p.isBot,
    isOnline: p.isBot ? true : p.sockets?.size > 0,
  }))
  return {
    id: room.id,
    spectateToken: room.spectateToken,
    topicId: room.topicId,
    topicName: room.topicName,
    difficulty: room.difficulty,
    organizerId: room.organizerId,
    status: room.status,
    currentQuestion: room.currentQuestion,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
    gamePlayers: players,
    totalQuestions: room.totalQuestions || QUESTIONS_PER_GAME,
  }
}
