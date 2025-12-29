import axios from 'axios'
import { STORAGE_KEYS } from './storage'

/**
 * Central HTTP client.
 * - Relative URLs (same origin) so it works behind nginx.
 * - Adds Authorization header when token is present.
 * - 30s timeout (Telegram WebView can be slow on mobile networks).
 * - Normalizes error messages to err.userMessage for UI.
 */
const api = axios.create({
  baseURL: '',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.token)
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'Network error'
    err.userMessage = msg
    throw err
  }
)

export const authAPI = {
  telegramLogin: (payload) => api.post('/api/auth/telegram', payload),
  telegramQrStart: () => api.post('/api/auth/telegram/qr/start'),
  telegramQrStatus: (qrToken) => api.get('/api/auth/telegram/qr/status', { params: { qrToken } }),
  telegramQrConfirm: (payload) => api.post('/api/auth/telegram/qr/confirm', payload),
  me: () => api.get('/api/auth/me'),
  // Alias for profile page
  getProfile: () => api.get('/api/auth/me'),
}

export const configAPI = {
  get: () => api.get('/api/config'),
}

export const gameAPI = {
  create: (payload) => api.post('/api/games/create', payload),
  get: (gameId) => api.get(`/api/games/${gameId}`),
  getSpectate: (spectateToken) => api.get(`/api/games/spectate/${spectateToken}`),
}

export const questionAPI = {
  getTopics: () => api.get('/api/questions/topics'),
  getTopicCollections: (topicId) => api.get(`/api/questions/topics/${encodeURIComponent(String(topicId))}/collections`),
}

export default api
