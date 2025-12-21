import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { configAPI } from '../utils/api'

const ConfigContext = createContext(null)

const parseBool = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return defaultValue
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}

export function ConfigProvider({ children }) {
  const [features, setFeatures] = useState({
    difficultySelection: parseBool(
      import.meta?.env?.VITE_FEATURE_DIFFICULTY_SELECTION ?? import.meta?.env?.VITE_FEATURE_QUESTION_RATING,
      false
    ),
    playersListInGame: parseBool(import.meta?.env?.VITE_FEATURE_PLAYERS_LIST_IN_GAME, true),
  })
  const [auth, setAuth] = useState({
    methods: {
      telegram: { enabled: true, mode: 'oauth' },
      email: { enabled: false },
      vk: { enabled: false },
    },
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const res = await configAPI.get()
        const serverFeatures = res?.data?.features || {}
        const serverAuth = res?.data?.auth || null
        if (!alive) return
        setFeatures((prev) => ({
          ...prev,
          ...serverFeatures,
        }))
        if (serverAuth && typeof serverAuth === 'object') setAuth(serverAuth)
      } catch (e) {
        // Safe fallback: keep defaults if config endpoint is unavailable
        console.warn('Failed to load /api/config, using defaults.', e?.userMessage || e?.message || e)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const value = useMemo(() => ({ features, auth, loading }), [features, auth, loading])

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}
