import {
  BOTS_PER_ROOM,
  DIFFICULTY_SCORE,
  MAX_PLAYERS_PER_ROOM,
  QUESTION_TIME_MS,
  QUESTIONS_PER_GAME,
  RANDOM_DISTRIBUTION,
  RECONNECT_GRACE_MS,
  REVEAL_TIME_MS,
  ROOM_TTL_MS,
  SCORING_TIME_MS,
} from './constants.js'

const parseBool = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return defaultValue
}

const formatMs = (ms) => {
  const n = Number(ms)
  if (!Number.isFinite(n)) return String(ms)
  const s = Math.round((n / 1000) * 100) / 100
  return `${n}ms (${s}s)`
}

const onOff = (v) => (v ? 'ON' : 'OFF')

export const logStartupInfo = ({
  port,
  corsOrigin,
  socketPingIntervalMs,
  socketPingTimeoutMs,
} = {}) => {
  const env = process.env.NODE_ENV || 'development'

  // Feature flags
  const difficultySelection =
    parseBool(process.env.FEATURE_DIFFICULTY_SELECTION, false) ||
    // Backward-compat: older env name used in some setups
    parseBool(process.env.FEATURE_QUESTION_RATING, false)
  const playersListInGame = parseBool(process.env.FEATURE_PLAYERS_LIST_IN_GAME, true)
  const bots = parseBool(process.env.FEATURE_BOTS, false)
  const botsCount = BOTS_PER_ROOM

  // Logs/debug
  const logSockets = parseBool(process.env.LOG_SOCKETS, env !== 'production')
  const logRooms = parseBool(process.env.LOG_ROOMS, env !== 'production')
  const debugSessions = parseBool(process.env.DEBUG_SESSIONS, false)

  const lines = [
    `🚀 QUIZZY Backend started`,
    `- env: ${env}`,
    `- pid: ${process.pid}`,
    `- port: ${port ?? process.env.PORT ?? 'n/a'}`,
    `- cors.origin: ${corsOrigin ?? 'n/a'}`,
    `- socket.io: pingInterval=${formatMs(socketPingIntervalMs)} pingTimeout=${formatMs(socketPingTimeoutMs)}`,
    `- features: difficultySelection=${onOff(difficultySelection)} playersListInGame=${onOff(
      playersListInGame
    )} bots=${onOff(bots)} (count=${botsCount})`,
    `- logging: LOG_ROOMS=${onOff(logRooms)} LOG_SOCKETS=${onOff(logSockets)} DEBUG_SESSIONS=${onOff(debugSessions)}`,
    `- game: QUESTIONS_PER_GAME=${QUESTIONS_PER_GAME}`,
    `- rooms: MAX_PLAYERS_PER_ROOM=${MAX_PLAYERS_PER_ROOM} (bots included)`,
    `- timeouts: QUESTION_TIME_MS=${formatMs(QUESTION_TIME_MS)} REVEAL_TIME_MS=${formatMs(
      REVEAL_TIME_MS
    )} SCORING_TIME_MS=${formatMs(SCORING_TIME_MS)} RECONNECT_GRACE_MS=${formatMs(
      RECONNECT_GRACE_MS
    )} ROOM_TTL_MS=${formatMs(ROOM_TTL_MS)}`,
    `- scoring: DIFFICULTY_SCORE=${JSON.stringify(DIFFICULTY_SCORE)} RANDOM_DISTRIBUTION=${JSON.stringify(
      RANDOM_DISTRIBUTION
    )}`,
  ]

  console.log(lines.join('\n'))
}
