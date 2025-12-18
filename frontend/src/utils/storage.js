export const STORAGE_KEYS = {
  token: 'quizzy_token',
  user: 'quizzy_user',
  activeGame: 'quizzy_active_game',
  activePhase: 'quizzy_active_phase',
  clientSessionId: 'quizzy_client_session_id',
  telegramWebAppUserId: 'quizzy_tg_user_id',
  lastRoomHint: 'quizzy_last_room_hint',
  sessionSuspended: 'quizzy_session_suspended',
  sessionSuspendedAt: 'quizzy_session_suspended_at',
}

export const ACTIVE_GAME_TTL_MS = 1000 * 60 * 60 // 1 час

let inMemoryClientSessionId = null

export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function setActiveGame(id, phase = 'room', ttlMs = ACTIVE_GAME_TTL_MS) {
  if (!id) return
  const expiresAt = Date.now() + ttlMs
  writeJSON(STORAGE_KEYS.activeGame, { id, phase, expiresAt })
  localStorage.setItem(STORAGE_KEYS.activePhase, phase)
}

export function getActiveGame() {
  const data = readJSON(STORAGE_KEYS.activeGame, null)
  if (!data || typeof data !== 'object') return null
  if (!data.id || !data.expiresAt || data.expiresAt < Date.now()) return null
  const phase = data.phase || localStorage.getItem(STORAGE_KEYS.activePhase) || 'room'
  return { id: data.id, phase }
}

export function clearActiveGame() {
  localStorage.removeItem(STORAGE_KEYS.activeGame)
  localStorage.removeItem(STORAGE_KEYS.activePhase)
}

export function setLastRoomHint(gameId) {
  try {
    if (!gameId) return
    localStorage.setItem(STORAGE_KEYS.lastRoomHint, String(gameId))
  } catch {
    // ignore
  }
}

export function getLastRoomHint() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.lastRoomHint)
    return v ? String(v) : ''
  } catch {
    return ''
  }
}

export function clearLastRoomHint() {
  try {
    localStorage.removeItem(STORAGE_KEYS.lastRoomHint)
  } catch {
    // ignore
  }
}

export function getClientSessionId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.clientSessionId)
    if (existing && typeof existing === 'string' && existing.length >= 8 && existing.length <= 120) return existing

    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    localStorage.setItem(STORAGE_KEYS.clientSessionId, id)
    return id
  } catch {
    if (inMemoryClientSessionId) return inMemoryClientSessionId
    inMemoryClientSessionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    return inMemoryClientSessionId
  }
}

export function setSessionSuspended(value = true) {
  try {
    localStorage.setItem(STORAGE_KEYS.sessionSuspended, value ? '1' : '0')
    if (value) localStorage.setItem(STORAGE_KEYS.sessionSuspendedAt, String(Date.now()))
    else localStorage.removeItem(STORAGE_KEYS.sessionSuspendedAt)
  } catch {
    // ignore
  }
}

export function clearSessionSuspended() {
  try {
    localStorage.removeItem(STORAGE_KEYS.sessionSuspended)
    localStorage.removeItem(STORAGE_KEYS.sessionSuspendedAt)
  } catch {
    // ignore
  }
}

export function isSessionSuspended() {
  try {
    return localStorage.getItem(STORAGE_KEYS.sessionSuspended) === '1'
  } catch {
    return false
  }
}

export function getSessionSuspendedAt() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.sessionSuspendedAt)
    const n = v ? Number(v) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function isSessionSuspendedRecent(maxAgeMs = 4000) {
  if (!isSessionSuspended()) return false
  const at = getSessionSuspendedAt()
  if (!at) return false
  return Date.now() - at <= maxAgeMs
}
