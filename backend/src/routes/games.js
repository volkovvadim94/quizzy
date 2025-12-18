import express from 'express'
import pkg from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import {
  createRoomState,
  generateRoomCode,
  getRoomState,
  listRooms,
  roomToPublic,
} from '../utils/roomStore.js'
import { DIFFICULTY_LABELS } from '../utils/constants.js'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const router = express.Router()

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
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(existing.players.keys()) } },
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

    logEvent('room.create', {
      roomId: room.id,
      organizerId: room.organizerId,
      topicId: room.topicId,
      difficulty: room.difficulty,
    })

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(room.players.keys()) } },
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
    const room = getRoomState(req.params.spectateToken)
    if (!room) return res.status(404).json({ error: 'Комната не найдена' })

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(room.players.keys()) } },
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
        question: q,
      })),
    })
  } catch (error) {
    console.error('Spectate room error:', error)
    res.status(500).json({ error: 'Не удалось получить данные для просмотра' })
  }
})

router.get('/:gameId', authenticateToken, async (req, res) => {
  try {
    const room = getRoomState(req.params.gameId)
    if (!room) return res.status(404).json({ error: 'Комната не найдена или уже завершена' })

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(room.players.keys()) } },
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
