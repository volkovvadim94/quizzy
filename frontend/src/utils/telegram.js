export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return window?.Telegram?.WebApp || null
}

export function isTelegramWebApp() {
  const tg = getTelegramWebApp()
  return Boolean(tg?.initData && typeof tg.initData === 'string' && tg.initData.length > 0)
}

export function safeTgCall(methodName) {
  const tg = getTelegramWebApp()
  if (!tg) return
  try {
    const fn = tg?.[methodName]
    if (typeof fn === 'function') fn.call(tg)
  } catch (e) {
    // Never crash the app because of Telegram client quirks
    console.warn(`Telegram WebApp ${methodName} failed:`, e)
  }
}

export function getInitDataRaw() {
  const tg = getTelegramWebApp()
  const raw = tg?.initData
  return typeof raw === 'string' ? raw : ''
}

export function parseTelegramWebAppUser(initDataRaw = '') {
  if (!initDataRaw || typeof initDataRaw !== 'string') return null
  try {
    const params = new URLSearchParams(initDataRaw)
    const userStr = params.get('user')
    if (!userStr) return null
    const user = JSON.parse(userStr)
    return user && typeof user === 'object' ? user : null
  } catch {
    return null
  }
}
