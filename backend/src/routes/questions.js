import express from 'express'
import pkg from '@prisma/client'
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
router.get('/topics', async (_req, res) => {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { questions: true } },
      },
    })

    const topicsWithCounts = topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      icon: '',
      questionCount: topic._count.questions,
    }))

    res.json(topicsWithCounts)
  } catch (error) {
    console.error('Get topics error:', error)
    res.status(500).json({ error: 'Failed to get topics' })
  }
})

export default router
