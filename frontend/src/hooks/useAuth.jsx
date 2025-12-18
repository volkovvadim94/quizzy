import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authAPI } from '../utils/api'
import { STORAGE_KEYS, readJSON, writeJSON } from '../utils/storage'
import { getInitDataRaw, isTelegramWebApp, parseTelegramWebAppUser } from '../utils/telegram'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const setUserAndCache = useCallback((player) => {
    setUser(player)
    writeJSON(STORAGE_KEYS.user, player)
  }, [])

  const clearAuth = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token)
    localStorage.removeItem(STORAGE_KEYS.user)
    localStorage.removeItem(STORAGE_KEYS.activeGame)
    localStorage.removeItem(STORAGE_KEYS.activePhase)
    localStorage.removeItem(STORAGE_KEYS.telegramWebAppUserId)
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.token)
    if (!token) return null
    try {
      const res = await authAPI.me()
      const data = res.data || {}
      // /api/auth/me returns { success, player, rank, ... }
      const player = data.player || data
      setUserAndCache(player)
      return player
    } catch (e) {
      clearAuth()
      return null
    }
  }, [clearAuth, setUserAndCache])

  const login = useCallback(
    async (payload) => {
      try {
        const res = await authAPI.telegramLogin(payload)
        const data = res.data || {}
        if (data.success === false) {
          throw new Error(data.error || 'Ошибка авторизации')
        }
        const token = data.token
        const player = data.player
        if (!token || !player) {
          throw new Error('Некорректный ответ сервера авторизации')
        }

        localStorage.setItem(STORAGE_KEYS.token, token)
        setUserAndCache(player)

        const initDataRaw = payload?.initDataRaw
        const webAppUser = initDataRaw ? parseTelegramWebAppUser(initDataRaw) : null
        if (webAppUser?.id) {
          localStorage.setItem(STORAGE_KEYS.telegramWebAppUserId, String(webAppUser.id))
        } else if (payload?.id) {
          localStorage.setItem(STORAGE_KEYS.telegramWebAppUserId, String(payload.id))
        }

        // подтянуть актуальное состояние профиля (очки/аватар и т.д.)
        await refreshMe()

        return player
      } catch (e) {
        const msg = e?.userMessage || e?.message || 'Ошибка авторизации'
        throw new Error(msg)
      }
    },
    [refreshMe, setUserAndCache]
  )

  const logout = useCallback(() => {
    clearAuth()
    // hard reload to reset socket/game state
    window.location.replace('/')
  }, [clearAuth])

  // bootstrap from cache + sync with server
  useEffect(() => {
    ;(async () => {
      if (isTelegramWebApp()) {
        const initDataRaw = getInitDataRaw()
        const webAppUser = parseTelegramWebAppUser(initDataRaw)
        const currentTgId = webAppUser?.id ? String(webAppUser.id) : null
        const cachedTgId = localStorage.getItem(STORAGE_KEYS.telegramWebAppUserId)
        if (currentTgId && (!cachedTgId || cachedTgId !== currentTgId)) clearAuth()
      }

      const token = localStorage.getItem(STORAGE_KEYS.token)
      const cachedUser = readJSON(STORAGE_KEYS.user, null)
      if (token && cachedUser) setUser(cachedUser)
      if (token) await refreshMe()
      setLoading(false)
    })()
  }, [refreshMe, clearAuth])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshMe,
    }),
    [user, loading, login, logout, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
