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

export function getTelegramStartParam() {
  // Prefer Telegram WebApp API when available.
  const tg = getTelegramWebApp()
  const raw = tg?.initDataUnsafe?.start_param
  if (typeof raw === 'string' && raw) return raw

  // Fallback: Telegram also passes start param via URL (e.g. tgWebAppStartParam) in some clients.
  if (typeof window === 'undefined') return ''
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('tgWebAppStartParam')
    if (fromSearch) return fromSearch
  } catch {
    // ignore
  }
  try {
    const hash = String(window.location.hash || '').replace(/^#/, '')
    const fromHash = new URLSearchParams(hash).get('tgWebAppStartParam')
    if (fromHash) return fromHash
  } catch {
    // ignore
  }

  return ''
}

export function buildTelegramMiniAppUrl(payload = '') {
  const p = String(payload || '').trim()
  if (!p) return ''
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
  if (!botUsername) return ''

  const appName = import.meta.env.VITE_TELEGRAM_WEBAPP_NAME
  const base = appName ? `https://t.me/${botUsername}/${appName}` : `https://t.me/${botUsername}`
  return `${base}?startapp=${encodeURIComponent(p)}`
}
