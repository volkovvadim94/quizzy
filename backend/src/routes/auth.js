import express from 'express'
import crypto from 'crypto'
import pkg from '@prisma/client'
import { authenticateToken, generateToken } from '../middleware/auth.js'

const { PrismaClient } = pkg
const router = express.Router()
const prisma = new PrismaClient()
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

// Проверка данных WebApp (initData)
const verifyWebAppInitData = (initDataRaw = '') => {
  if (!BOT_TOKEN || !initDataRaw) return { ok: false, reason: 'no_token_or_data' }
  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'no_hash' }

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return { ok: false, reason: 'auth_date_expired' }
  }

  // data-check-string по правилам Telegram: сортируем все пары кроме hash
  params.delete('hash')
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // WebApp verification uses secret key derived as HMAC("WebAppData", botToken)
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  return { ok: computed === hash, reason: computed === hash ? 'ok' : 'hash_mismatch' }
}

const verifyTelegramData = (telegramData = {}) => {
  if (!BOT_TOKEN) return false

  const { hash, auth_date, authDate, ...rest } = telegramData
  if (!hash) return false

  const authTime = Number(auth_date || authDate)
  if (!authTime || Date.now() / 1000 - authTime > 86400) {
    return false
  }

  const dataCheckString = Object.entries({ ...rest, auth_date: authTime })
    .filter(([_, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  return computedHash === hash
}

router.post('/telegram', async (req, res) => {
  try {
    const telegramData = req.body || {}
    const hasInitDataRaw = Boolean(telegramData.initDataRaw)

    // WebApp sends only initDataRaw; extract a safe preview for logs (without trusting it yet).
    let previewId = telegramData.id
    let previewUsername = telegramData.username
    let previewAuthDate = telegramData.auth_date || telegramData.authDate
    if (hasInitDataRaw && (!previewId || !previewAuthDate)) {
      try {
        const params = new URLSearchParams(telegramData.initDataRaw)
        previewAuthDate = params.get('auth_date') || previewAuthDate
        const userStr = params.get('user')
        const parsedUser = userStr ? JSON.parse(userStr) : {}
        previewId = parsedUser?.id ?? previewId
        previewUsername = parsedUser?.username ?? previewUsername
      } catch {
        // ignore
      }
    }

    console.log('🔐 Received Telegram auth data:', {
      id: previewId,
      username: previewUsername,
      auth_date: previewAuthDate,
      hasInitDataRaw,
      initDataLen: hasInitDataRaw ? String(telegramData.initDataRaw || '').length : 0,
    })

    // Ветка WebApp: присылаем сырой initData и проверяем его
    if (telegramData.initDataRaw) {
      const check = verifyWebAppInitData(telegramData.initDataRaw)
      if (!check.ok) {
        console.warn('❌ WebApp initData verification failed:', check.reason)
        return res.status(401).json({ success: false, error: 'Invalid Telegram WebApp data', reason: check.reason })
      }
      const params = new URLSearchParams(telegramData.initDataRaw)
      const userStr = params.get('user')
      const parsedUser = userStr ? JSON.parse(userStr) : {}
      telegramData.id = parsedUser.id
      telegramData.username = parsedUser.username
      telegramData.first_name = parsedUser.first_name
      telegramData.last_name = parsedUser.last_name
      telegramData.photo_url = parsedUser.photo_url
      telegramData.auth_date = params.get('auth_date')
      telegramData.hash = params.get('hash')
    } else {
      // Обычный логин-виджет
      if (!verifyTelegramData(telegramData)) {
        console.warn('❌ Widget data verification failed')
        return res.status(401).json({ success: false, error: 'Invalid Telegram data' })
      }
    }

    const { id, username, first_name, last_name, photo_url } = telegramData

    if (!id) {
      return res.status(400).json({ error: 'Telegram ID is required' })
    }

    let user = await prisma.user.findUnique({
      where: { telegramId: id.toString() },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: id.toString(),
          username: username || `user_${id.toString().slice(0, 6)}`,
          firstName: first_name || 'User',
          lastName: last_name || '',
          avatarUrl: photo_url || '',
        },
      })
      console.log('✅ Created new user:', user.id)
    } else {
      user = await prisma.user.update({
        where: { telegramId: id.toString() },
        data: {
          username: username || user.username,
          firstName: first_name || user.firstName,
          lastName: last_name || user.lastName,
          avatarUrl: photo_url || user.avatarUrl,
        },
      })
      console.log('🔄 Updated existing user:', user.id)
    }

    const token = generateToken(user)

    console.log('✅ Login successful for user:', user.username)

    res.json({
      success: true,
      token,
      player: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        totalScore: user.totalScore,
      },
    })
  } catch (error) {
    console.error('❌ Auth error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    })
  }
})

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        totalScore: true,
      },
    })

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const agg = await prisma.userTopicScore.aggregate({
      where: { userId: user.id },
      _sum: { score: true },
    })
    const totalScore = agg._sum.score || 0
    if (totalScore !== user.totalScore) {
      await prisma.user.update({ where: { id: user.id }, data: { totalScore } })
    }
    const player = { ...user, totalScore }

    const betterCount = await prisma.user.count({
      where: { totalScore: { gt: totalScore } },
    })
    const totalPlayers = await prisma.user.count()
    const rank = betterCount + 1

    const topPlayers = await prisma.user.findMany({
      orderBy: { totalScore: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        totalScore: true,
      },
    })

    res.json({
      success: true,
      player,
      rank,
      totalPlayers,
      topPlayers,
    })
  } catch (error) {
    console.error('ў?? Profile fetch error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    })
  }
})

export default router
