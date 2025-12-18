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
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const res = await configAPI.get()
        const serverFeatures = res?.data?.features || {}
        if (!alive) return
        setFeatures((prev) => ({
          ...prev,
          ...serverFeatures,
        }))
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

  const value = useMemo(() => ({ features, loading }), [features, loading])

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}
