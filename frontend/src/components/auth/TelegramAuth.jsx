import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../../hooks/useAuth'
import { useConfig } from '../../hooks/useConfig'
import { authAPI } from '../../utils/api'
import { buildTelegramMiniAppUrl, getInitDataRaw, isTelegramWebApp, safeTgCall } from '../../utils/telegram'

const BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID

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

export default function TelegramAuth() {
  const { login, user } = useAuth()
  const { auth } = useConfig()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [qrOpen, setQrOpen] = useState(false)
  const [qrToken, setQrToken] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [qrExpiresAtMs, setQrExpiresAtMs] = useState(0)

  const webAppLoginStarted = useRef(false)

  const isWebApp = isTelegramWebApp()
  const initDataRaw = useMemo(() => (isWebApp ? getInitDataRaw() : ''), [isWebApp])

  const telegramCfg = auth?.methods?.telegram || { enabled: true, mode: 'oauth' }
  const telegramEnabled = telegramCfg.enabled !== false
  const telegramMode = String(telegramCfg.mode || 'oauth')

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

  const resetQr = () => {
    setQrOpen(false)
    setQrToken('')
    setQrUrl('')
    setQrExpiresAtMs(0)
  }

  const startQr = useCallback(async () => {
    const r = await authAPI.telegramQrStart()
    const token = r?.data?.qrToken || ''
    const expiresAtMs = Number(r?.data?.expiresAtMs || 0)
    if (!token) throw new Error('Failed to start QR login')

    const url = buildTelegramMiniAppUrl(`login_${token}`)
    if (!url) throw new Error('Missing VITE_TELEGRAM_BOT_USERNAME / VITE_TELEGRAM_WEBAPP_NAME for deep-link')

    setQrToken(token)
    setQrExpiresAtMs(expiresAtMs)
    setQrUrl(url)
  }, [])

  const loginWeb = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      if (!telegramEnabled) throw new Error('Telegram login disabled')
      if (!BOT_ID) throw new Error('Missing VITE_TELEGRAM_BOT_ID')

      if (telegramMode === 'qr') {
        setQrOpen(true)
        await startQr()
        return
      }

      const originNoPort = `${window.location.protocol}//${window.location.hostname}`
      const hasPort = Boolean(window.location.port)
      if (hasPort) {
        setError(`OAuth не работает на домене с портом. Либо открой ${originNoPort}/welcome, либо включи QR-логин в env.`)
        return
      }

      const origin = originNoPort
      const returnTo = `${originNoPort}/welcome`
      const url =
        `https://oauth.telegram.org/auth?bot_id=${encodeURIComponent(String(BOT_ID))}` +
        `&origin=${encodeURIComponent(origin)}` +
        `&request_access=write` +
        `&return_to=${encodeURIComponent(returnTo)}`

      window.location.assign(url)
    } catch (e) {
      setError(e?.message || 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }, [telegramEnabled, telegramMode, startQr])

  useEffect(() => {
    if (!qrOpen || !qrToken) return

    let stopped = false
    const interval = setInterval(async () => {
      if (stopped) return
      try {
        const r = await authAPI.telegramQrStatus(qrToken)
        const status = r?.data?.status
        if (status === 'approved') {
          stopped = true
          clearInterval(interval)
          await login({ qrToken })
          resetQr()
          navigate('/', { replace: true })
        }
      } catch (e) {
        const code = e?.response?.status
        if (code === 404 || code === 410) {
          stopped = true
          clearInterval(interval)
          setError('QR устарел. Нажми войти ещё раз.')
          resetQr()
        }
      }
    }, 1000)

    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [qrOpen, qrToken, login, navigate])

  if (isWebApp) {
    return (
      <div className="flex items-center justify-center w-full">
        <div className="text-white/80 text-sm">{loading ? 'Авторизация…' : error ? error : 'Готово'}</div>
      </div>
    )
  }

  return (
    <div className="card w-full max-w-sm bg-base-200 shadow-xl">
      <div className="card-body space-y-4 text-center">
        <div className="text-xl font-bold">Войти</div>

        {error && <div className="text-error text-sm">{error}</div>}

        <button
          className={`btn btn-primary w-full gap-2 ${loading || !telegramEnabled ? 'btn-disabled' : ''}`}
          onClick={loginWeb}
          disabled={loading || !telegramEnabled}
        >
          <Send size={18} />
          <span>{loading ? 'Загрузка…' : telegramMode === 'qr' ? 'Войти через Telegram (QR)' : 'Войти через Telegram'}</span>
        </button>

        <div className="text-xs opacity-60 leading-relaxed">
          OAuth может требовать настройки домена в BotFather (<span className="font-mono">/setdomain</span>).
        </div>
      </div>

      {qrOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <div className="font-bold text-lg">Войти через Telegram</div>
            <div className="text-sm opacity-70 mt-1">Отсканируй QR в Telegram, чтобы подтвердить вход.</div>

            <div className="mt-4 flex items-center justify-center">
              {qrUrl ? (
                <div className="p-3 rounded-2xl" style={{ background: 'var(--quizzy-surface-2)' }}>
                  <QRCodeCanvas value={qrUrl} size={220} includeMargin />
                </div>
              ) : (
                <div className="text-sm opacity-70">Генерируем QR…</div>
              )}
            </div>

            {qrUrl ? (
              <div className="mt-3 flex flex-col gap-2">
                <a className="btn btn-sm" href={qrUrl}>
                  Открыть в Telegram
                </a>
                <div className="text-xs opacity-60 break-all">{qrUrl}</div>
                {qrExpiresAtMs ? <div className="text-xs opacity-60">Истечёт: {new Date(qrExpiresAtMs).toLocaleTimeString()}</div> : null}
              </div>
            ) : null}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={resetQr}>
                Закрыть
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  )
}

