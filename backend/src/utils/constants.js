export const QUESTIONS_PER_GAME = 5

export const DIFFICULTY_LABELS = ['easy', 'medium', 'hard', 'hardcore']

export const DIFFICULTY_SCORE = {
  easy: 100,
  medium: 150,
  hard: 200,
  hardcore: 250,
}

export const RANDOM_DISTRIBUTION = {
  easy: 0.2,
  medium: 0.4,
  hard: 0.2,
  hardcore: 0.1,
}

export const QUESTION_TIME_MS = 15000
export const REVEAL_TIME_MS = 3000
export const SCORING_TIME_MS = 5000

export const RECONNECT_GRACE_MS = 10000

const parseIntEnv = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

// Hard cap for real+bot players in a room.
export const MAX_PLAYERS_PER_ROOM = Math.max(1, Math.min(50, parseIntEnv(process.env.MAX_PLAYERS_PER_ROOM, 50)))

// Bots per room (feature-gated by FEATURE_BOTS). Can be overridden via env.
export const BOTS_PER_ROOM = Math.max(0, Math.min(50, parseIntEnv(process.env.BOTS_PER_ROOM, 49)))

// Force-close any room after this TTL to avoid stale sessions.
export const ROOM_TTL_MS = 10 * 60 * 1000
