import express from 'express'
import pkg from '@prisma/client'
import { optionalAuthenticateToken } from '../middleware/auth.js'
const { PrismaClient } = pkg

const router = express.Router()
const prisma = new PrismaClient()

// Получить вопросы по теме/сложности (без рейтингов)
router.get('/', async (req, res) => {
  try {
    const { topicId, difficultyPreset, limit = 20 } = req.query

    const where = {}
    if (topicId) where.topicId = Number(topicId)
    if (difficultyPreset !== undefined) where.difficultyPreset = Number(difficultyPreset)

    const questions = await prisma.question.findMany({
      where,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    })

    res.json(questions)
  } catch (error) {
    console.error('Get questions error:', error)
    res.status(500).json({ error: 'Failed to get questions' })
  }
})

// Темы из отдельной таблицы
router.get('/topics', optionalAuthenticateToken, async (req, res) => {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { questions: true, collections: true } },
      },
    })

    const userId = req?.user?.id ? Number(req.user.id) : null
    const lockedTopicIds = userId
      ? new Set(
          (await prisma.userTopicLock.findMany({
            where: { userId },
            select: { topicId: true },
          })).map((r) => r.topicId)
        )
      : new Set()

    const topicsWithCounts = topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      icon: '',
      questionCount: topic._count.questions,
      collectionCount: topic._count.collections,
      isLocked: lockedTopicIds.has(topic.id),
    }))

    res.json(topicsWithCounts)
  } catch (error) {
    console.error('Get topics error:', error)
    res.status(500).json({ error: 'Failed to get topics' })
  }
})

router.get('/topics/:topicId/collections', optionalAuthenticateToken, async (req, res) => {
  try {
    const topicId = Number(req.params.topicId)
    if (!Number.isFinite(topicId)) return res.status(400).json({ error: 'Invalid topicId' })

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, name: true, slug: true },
    })
    if (!topic) return res.status(404).json({ error: 'Topic not found' })

    const userId = req?.user?.id ? Number(req.user.id) : null
    const topicLocked = userId
      ? Boolean(
          await prisma.userTopicLock.findUnique({
            where: { userId_topicId: { userId, topicId } },
            select: { userId: true },
          })
        )
      : false

    const lockedCollectionIds = userId
      ? new Set(
          (await prisma.userCollectionLock.findMany({
            where: { userId, collection: { topicId } },
            select: { collectionId: true },
          })).map((r) => r.collectionId)
        )
      : new Set()

    const collections = await prisma.collection.findMany({
      where: { topicId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { questions: true } } },
    })

    res.json({
      topic,
      collections: collections.map((c) => ({
        id: c.id,
        topicId: c.topicId,
        name: c.name,
        slug: c.slug,
        isFree: c.isFree,
        priceGems: c.priceGems,
        questionCount: c._count.questions,
        isLocked: topicLocked || lockedCollectionIds.has(c.id),
      })),
    })
  } catch (error) {
    console.error('Get collections error:', error)
    res.status(500).json({ error: 'Failed to get collections' })
  }
})

export default router
