import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getInitDataRaw, isTelegramWebApp, safeTgCall } from '../../utils/telegram'

const BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID
const TG_WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'

// Redirect-style widget (rare): ?id=...&first_name=...&auth_date=...&hash=...
function readTelegramRedirectParams() {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')
  const hash = params.get('hash')
  const auth_date = params.get('auth_date')
  if (!id || !hash || !auth_date) return null
  return {
    id,
    first_name: params.get('first_name') || undefined,
    last_name: params.get('last_name') || undefined,
    username: params.get('username') || undefined,
    photo_url: params.get('photo_url') || undefined,
    auth_date,
    hash,
  }
}

function ensureWidgetScriptLoaded() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve()
    if (window.Telegram?.Login?.auth) return resolve()
    const existing = document.querySelector(`script[src="${TG_WIDGET_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Telegram widget')))
      return
    }
    const script = document.createElement('script')
    script.src = TG_WIDGET_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Не удалось загрузить Telegram widget'))
    document.body.appendChild(script)
  })
}

export default function TelegramAuth() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const webAppLoginStarted = useRef(false)

  const isWebApp = isTelegramWebApp()
  const initDataRaw = useMemo(() => (isWebApp ? getInitDataRaw() : ''), [isWebApp])

  // 1) Redirect-style login
  useEffect(() => {
    if (user) return
    const redirectData = readTelegramRedirectParams()
    if (!redirectData) return
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        await login(redirectData)
        window.history.replaceState({}, document.title, window.location.pathname)
        navigate('/', { replace: true })
      } catch (e) {
        setError(e?.message || 'Ошибка авторизации')
      } finally {
        setLoading(false)
      }
    })()
  }, [user, login, navigate])

  // 2) Telegram WebApp autologin
  useEffect(() => {
    if (user) return
    if (!isWebApp) return
    if (!initDataRaw) return
    if (webAppLoginStarted.current) return

    webAppLoginStarted.current = true

    ;(async () => {
      try {
        setLoading(true)
        setError('')
        safeTgCall('ready')
        safeTgCall('expand')
        await login({ initDataRaw })
        navigate('/', { replace: true })
      } catch (e) {
        setError(e?.message || 'Ошибка авторизации')
        webAppLoginStarted.current = false
      } finally {
        setLoading(false)
      }
    })()
  }, [user, isWebApp, initDataRaw, login, navigate])

  const loginWeb = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      if (!BOT_ID) {
        throw new Error('Не задан VITE_TELEGRAM_BOT_ID')
      }

      await ensureWidgetScriptLoaded()

      const t = window.Telegram
      if (!t?.Login?.auth) {
        throw new Error('Telegram widget не доступен')
      }

      await new Promise((resolve, reject) => {
        t.Login.auth({ bot_id: BOT_ID, request_access: 'write' }, async (data) => {
          if (!data) {
            reject(new Error('Авторизация отменена'))
            return
          }
          try {
            await login(data)
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })

      navigate('/', { replace: true })
    } catch (e) {
      setError(e?.message || 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }, [login, navigate])

  // In WebApp we show a small status line; main CTA is in the page body
  if (isWebApp) {
    return (
      <div className="flex items-center justify-center w-full">
        <div className="text-white/80 text-sm">
          {loading ? 'Входим через Telegram…' : error ? error : 'Подключаемся…'}
        </div>
      </div>
    )
  }

  return (
    <div className="card w-full max-w-sm bg-base-200 shadow-xl">
      <div className="card-body space-y-4 text-center">
        <div className="text-xl font-bold">Войти</div>

        {error && <div className="text-error text-sm">{error}</div>}

        <button className={`btn btn-primary w-full gap-2 ${loading ? 'btn-disabled' : ''}`} onClick={loginWeb} disabled={loading}>
          <Send size={18} />
          <span>{loading ? 'Входим…' : 'Войти через Telegram'}</span>
        </button>
      </div>
    </div>
  )
}
