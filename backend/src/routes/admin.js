import express from 'express'
import pkg from '@prisma/client'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const router = express.Router()

const requireAdminSecret = (req, res, next) => {
  const expected = String(process.env.ADMIN_SECRET || '').trim()
  if (!expected) return res.status(500).json({ error: 'ADMIN_SECRET is not configured' })

  const provided = String(req.headers['x-admin-secret'] || '').trim()
  if (!provided || provided !== expected) return res.status(403).json({ error: 'Forbidden' })
  next()
}

router.use(requireAdminSecret)

const resolveUserId = async ({ userId, telegramId } = {}) => {
  const uid = Number(userId)
  if (Number.isFinite(uid) && uid > 0) return uid

  const tg = String(telegramId || '').trim()
  if (!tg) return null

  const user = await prisma.user.findUnique({ where: { telegramId: tg }, select: { id: true } })
  return user?.id || null
}

router.get('/users/:userId/locks', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid userId' })

    const [topicLocks, collectionLocks] = await Promise.all([
      prisma.userTopicLock.findMany({ where: { userId }, select: { topicId: true, reason: true, lockedAt: true } }),
      prisma.userCollectionLock.findMany({
        where: { userId },
        select: { collectionId: true, reason: true, lockedAt: true },
      }),
    ])

    res.json({ userId, topicLocks, collectionLocks })
  } catch (e) {
    console.error('Admin get locks error:', e)
    res.status(500).json({ error: 'Failed to get locks' })
  }
})

router.post('/locks', async (req, res) => {
  try {
    const { userId, telegramId, topicId, collectionId, locked = true, reason } = req.body || {}
    const resolvedUserId = await resolveUserId({ userId, telegramId })
    if (!resolvedUserId) return res.status(400).json({ error: 'User not found' })

    const hasTopic = topicId !== undefined && topicId !== null && String(topicId).trim() !== ''
    const hasCollection = collectionId !== undefined && collectionId !== null && String(collectionId).trim() !== ''
    if (!hasTopic && !hasCollection) return res.status(400).json({ error: 'topicId or collectionId is required' })

    const doLock = Boolean(locked)
    const reasonStr = reason ? String(reason).slice(0, 200) : null

    if (hasTopic) {
      const tid = Number(topicId)
      if (!Number.isFinite(tid)) return res.status(400).json({ error: 'Invalid topicId' })
      if (doLock) {
        await prisma.userTopicLock.upsert({
          where: { userId_topicId: { userId: resolvedUserId, topicId: tid } },
          update: { reason: reasonStr },
          create: { userId: resolvedUserId, topicId: tid, reason: reasonStr },
        })
      } else {
        await prisma.userTopicLock.deleteMany({ where: { userId: resolvedUserId, topicId: tid } })
      }
    }

    if (hasCollection) {
      const cid = Number(collectionId)
      if (!Number.isFinite(cid)) return res.status(400).json({ error: 'Invalid collectionId' })
      if (doLock) {
        await prisma.userCollectionLock.upsert({
          where: { userId_collectionId: { userId: resolvedUserId, collectionId: cid } },
          update: { reason: reasonStr },
          create: { userId: resolvedUserId, collectionId: cid, reason: reasonStr },
        })
      } else {
        await prisma.userCollectionLock.deleteMany({ where: { userId: resolvedUserId, collectionId: cid } })
      }
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('Admin update locks error:', e)
    res.status(500).json({ error: 'Failed to update locks' })
  }
})

export default router

