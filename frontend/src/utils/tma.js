import { getTelegramWebApp, isTelegramWebApp, safeTgCall } from './telegram'

export async function isTMA() {
  return isTelegramWebApp()
}

export function init() {
  safeTgCall('ready')
}

const mount = Object.assign(
  async () => {
    // No-op: kept for API-compat with Telegram Mini Apps SDK snippets.
  },
  { isAvailable: () => isTelegramWebApp() }
)

const requestFullscreen = Object.assign(
  async () => {
    const tg = getTelegramWebApp()
    if (!tg || typeof tg.requestFullscreen !== 'function') return
    try {
      const result = tg.requestFullscreen()
      if (result && typeof result.then === 'function') await result
    } catch (e) {
      console.warn('Telegram WebApp requestFullscreen failed:', e)
    }
  },
  {
    isAvailable: () => {
      const tg = getTelegramWebApp()
      return Boolean(tg && typeof tg.requestFullscreen === 'function')
    },
  }
)

export const viewport = {
  mount,
  expand: () => safeTgCall('expand'),
  requestFullscreen,
}

