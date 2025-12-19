import express from 'express'
import pkg from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import {
  createRoomState,
  addBotsToRoom,
  generateRoomCode,
  getRoomState,
  listRooms,
  roomToPublic,
} from '../utils/roomStore.js'
import { DIFFICULTY_LABELS } from '../utils/constants.js'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const router = express.Router()

const parseOptions = (options) => {
  if (Array.isArray(options)) return options
  try {
    return JSON.parse(options || '[]')
  } catch {
    return []
  }
}

const shuffleIndices = (n) => {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const getOrCreateOptionOrder = (room, question) => {
  if (!room || !question) return null
  if (!room.questionOptionOrders) room.questionOptionOrders = new Map()
  const existing = room.questionOptionOrders.get(question.id)
  if (Array.isArray(existing) && existing.length) return existing

  const opts = parseOptions(question.options)
  const n = Array.isArray(opts) ? opts.length : 0
  const order = n > 1 ? shuffleIndices(n) : Array.from({ length: n }, (_, i) => i)
  room.questionOptionOrders.set(question.id, order)
  return order
}

const toPublicQuestion = (room, question, { ensureOrder = false } = {}) => {
  const opts = parseOptions(question?.options)
  const order = ensureOrder ? getOrCreateOptionOrder(room, question) : room?.questionOptionOrders?.get?.(question?.id) || null
  const shuffled =
    Array.isArray(order) && order.length === opts.length
      ? order.map((i) => opts[i])
      : opts
  // Remove answers from spectate payload
  // eslint-disable-next-line no-unused-vars
  const { correctOption, correctSequence, ...rest } = { ...question, options: shuffled, optionOrder: order || null }
  return rest
}

const parseBool = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return defaultValue
}

const logRooms = () => parseBool(process.env.LOG_ROOMS, process.env.NODE_ENV !== 'production')
const logEvent = (tag, data = {}) => {
  if (!logRooms()) return
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

const featureBots = () => parseBool(process.env.FEATURE_BOTS, false)

const getRealPlayerIds = (room) =>
  Array.from(room?.players?.values?.() || [])
    .filter((p) => !p?.isBot && typeof p?.playerId === 'number' && p.playerId > 0)
    .map((p) => p.playerId)

const slugify = (str = '') =>
  str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const getTopicByPayload = async ({ topicId, topicName, topicSlug }) => {
  if (topicId) {
    const existing = await prisma.topic.findUnique({ where: { id: Number(topicId) } })
    if (existing) return existing
  }
  if (topicSlug) {
    const bySlug = await prisma.topic.findUnique({ where: { slug: topicSlug } })
    if (bySlug) return bySlug
  }
  if (topicName) {
    let topic = await prisma.topic.findFirst({ where: { name: topicName } })
    if (topic) return topic
    const slug = topicSlug || slugify(topicName) || `topic-${Date.now()}`
    topic = await prisma.topic.create({ data: { name: topicName, slug } })
    return topic
  }
  return null
}

const generateUniqueRoomCode = async () => {
  let code = generateRoomCode()
  let guard = 0
  // Проверяем, чтобы код не пересекался с сохраненными Room (на случай рестарта)
  while (guard < 10) {
    const existsDb = await prisma.room.findUnique({ where: { id: code } })
    if (!existsDb && !getRoomState(code)) {
      return code
    }
    code = generateRoomCode()
    guard += 1
  }
  return code
}

router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { topicId, topic: topicParam, topicSlug, difficulty } = req.body
    const topic = await getTopicByPayload({ topicId: topicId ?? topicParam, topicName: topicParam, topicSlug })

    if (!topic) {
      return res.status(400).json({ error: 'Тема не найдена' })
    }

    const allowDifficulty = featureDifficultySelection()
    const chosenDifficulty = allowDifficulty && difficulty ? difficulty : 'random'
    if (allowDifficulty && difficulty && !DIFFICULTY_LABELS.includes(difficulty) && difficulty !== 'random') {
      return res.status(400).json({ error: 'Некорректная сложность' })
    }

    // One active room per organizer: if it exists, return it instead of creating a new one.
    const existing = listRooms().find((r) => r.organizerId === req.user.id && r.status !== 'finished')
    if (existing) {
      logEvent('room.create.existing', { roomId: existing.id, organizerId: req.user.id, status: existing.status })
      if (featureBots()) addBotsToRoom(existing, { count: 10 })
      const users = await prisma.user.findMany({
        where: { id: { in: getRealPlayerIds(existing) } },
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
      return res.json({ ...roomToPublic(existing, byId), alreadyExists: true })
    }

    const code = await generateUniqueRoomCode()
    const room = createRoomState({
      id: code,
      topicId: topic.id,
      topicName: topic.name,
      difficulty: chosenDifficulty,
      organizerId: req.user.id,
    })
    if (featureBots()) addBotsToRoom(room, { count: 10 })

    logEvent('room.create', {
      roomId: room.id,
      organizerId: room.organizerId,
      topicId: room.topicId,
      difficulty: room.difficulty,
    })

    const users = await prisma.user.findMany({
      where: { id: { in: getRealPlayerIds(room) } },
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

    res.json(roomToPublic(room, byId))
  } catch (error) {
    console.error('Create room error:', error)
    res.status(500).json({ error: 'Не удалось создать комнату' })
  }
})

router.get('/spectate/:spectateToken', async (req, res) => {
  try {
    const token = String(req.params.spectateToken || '').toUpperCase()
    const room = getRoomState(token)
    if (!room) return res.status(404).json({ error: 'Комната не найдена' })

    const users = await prisma.user.findMany({
      where: { id: { in: getRealPlayerIds(room) } },
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

    res.json({
      id: room.id,
      topic: room.topicName,
      topicId: room.topicId,
      difficulty: room.difficulty,
      status: room.status,
      currentQuestion: room.currentQuestion,
      gamePlayers: roomToPublic(room, byId).gamePlayers,
      gameQuestions: room.questions.map((q, idx) => ({
        orderIndex: idx,
        question: toPublicQuestion(room, q, { ensureOrder: room.status === 'active' && idx === room.currentQuestion }),
      })),
    })
  } catch (error) {
    console.error('Spectate room error:', error)
    res.status(500).json({ error: 'Не удалось получить данные для просмотра' })
  }
})

router.get('/:gameId', authenticateToken, async (req, res) => {
  try {
    const gameId = String(req.params.gameId || '').toUpperCase()
    const room = getRoomState(gameId)
    if (!room) return res.status(404).json({ error: 'Комната не найдена или уже завершена' })

    const users = await prisma.user.findMany({
      where: { id: { in: getRealPlayerIds(room) } },
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

    res.json(roomToPublic(room, byId))
  } catch (error) {
    console.error('Get room error:', error)
    res.status(500).json({ error: 'Не удалось получить комнату' })
  }
})

export default router
