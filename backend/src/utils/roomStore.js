import { QUESTIONS_PER_GAME } from './constants.js'

const rooms = new Map()

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
    currentQuestion: 0,
    questions: [],
    players: new Map(),
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
  })
  return room
}

export const getRoomState = (id) => rooms.get(id)

export const deleteRoomState = (id) => rooms.delete(id)

export const listRooms = () => Array.from(rooms.values())

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
    })
  }
  return room.players.get(playerId)
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
    player: usersById[p.playerId] || { id: p.playerId },
    isOnline: p.sockets?.size > 0,
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
