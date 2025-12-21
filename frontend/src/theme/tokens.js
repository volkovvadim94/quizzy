const STORAGE_PREFIX = 'quizzy:tokenOverrides:'

export const TOKEN_DEFS = [
  { key: '--quizzy-body-bg', label: 'Фон (body)', group: 'Фон', type: 'color' },
  { key: '--quizzy-app-bg', label: 'Фон приложения', group: 'Фон', type: 'color' },
  { key: '--quizzy-text', label: 'Текст основной', group: 'Текст', type: 'color' },
  { key: '--quizzy-muted', label: 'Текст/иконки muted', group: 'Текст', type: 'color' },
  { key: '--quizzy-border', label: 'Граница/обводка (общая)', group: 'Текст', type: 'color' },

  { key: '--quizzy-surface', label: 'Подложка (card/surface)', group: 'Подложки', type: 'color' },
  { key: '--quizzy-surface-2', label: 'Подложка 2 (input)', group: 'Подложки', type: 'color' },

  { key: '--quizzy-header-bg', label: 'Шапка (browser)', group: 'Шапка', type: 'color' },
  { key: '--quizzy-tg-header-bg', label: 'Шапка (Telegram)', group: 'Шапка', type: 'color' },
  { key: '--quizzy-header-border', label: 'Разделитель шапки (низ)', group: 'Шапка', type: 'color' },

  { key: '--quizzy-primary', label: 'Primary', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-secondary', label: 'Secondary', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-danger', label: 'Danger', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-btn-bg', label: 'Кнопка базовая bg', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-btn-fg', label: 'Кнопка базовая fg', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-btn-primary-fg', label: 'Кнопка primary fg', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-btn-secondary-fg', label: 'Кнопка secondary fg', group: 'Кнопки', type: 'color' },
  { key: '--quizzy-ghost-fg', label: 'Кнопка ghost fg', group: 'Кнопки', type: 'color' },

  { key: '--quizzy-pill-bg', label: 'Плашка/пилюля bg', group: 'Элементы', type: 'color' },
  { key: '--quizzy-topic-btn-bg', label: 'Topic кнопка bg', group: 'Элементы', type: 'color' },
  { key: '--quizzy-accent', label: 'Акцент (жёлтый)', group: 'Элементы', type: 'color' },
  { key: '--quizzy-accent-fg', label: 'Акцент (текст)', group: 'Элементы', type: 'color' },

  { key: '--quizzy-topic-card-bg', label: 'Карточка темы bg', group: 'Тема (карточка)', type: 'color' },
  { key: '--quizzy-topic-card-title', label: 'Карточка темы title', group: 'Тема (карточка)', type: 'color' },
  { key: '--quizzy-topic-card-radius', label: 'Карточка темы radius', group: 'Тема (карточка)', type: 'range', min: 0, max: 28, step: 1, unit: 'px' },
  { key: '--quizzy-topic-card-overlay-rgb', label: 'Overlay (цвет)', group: 'Тема (карточка)', type: 'rgb' },
  {
    key: '--quizzy-topic-card-overlay-alpha-top',
    label: 'Overlay alpha (top)',
    group: 'Тема (карточка)',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: '--quizzy-topic-card-overlay-alpha-bottom',
    label: 'Overlay alpha (bottom)',
    group: 'Тема (карточка)',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
  },

  { key: '--quizzy-room-input-bg', label: 'Room input bg', group: 'Инпуты', type: 'color' },
  { key: '--quizzy-room-join-btn-bg', label: 'Кнопка "Войти" (комната) bg', group: 'Инпуты', type: 'color' },
  { key: '--quizzy-room-join-btn-fg', label: 'Кнопка "Войти" (комната) fg', group: 'Инпуты', type: 'color' },
  { key: '--quizzy-focus-ring', label: 'Focus ring', group: 'Инпуты', type: 'color' },
  { key: '--quizzy-placeholder', label: 'Placeholder', group: 'Инпуты', type: 'color' },

  { key: '--quizzy-player-row-bg', label: 'Плашка игрока bg', group: 'Игрок', type: 'color' },
  { key: '--quizzy-player-row-border', label: 'Плашка игрока border', group: 'Игрок', type: 'color' },
  { key: '--quizzy-player-row-border-self', label: 'Плашка игрока border (я)', group: 'Игрок', type: 'color' },
  { key: '--quizzy-player-row-radius', label: 'Плашка игрока radius', group: 'Игрок', type: 'range', min: 0, max: 28, step: 1, unit: 'px' },
  { key: '--quizzy-player-row-offline-opacity', label: 'Оффлайн opacity', group: 'Игрок', type: 'range', min: 0.2, max: 1, step: 0.05 },

  { key: '--quizzy-player-index-bg', label: '# номер bg', group: 'Игрок', type: 'color' },
  { key: '--quizzy-player-index-border', label: '# номер border', group: 'Игрок', type: 'color' },
  { key: '--quizzy-player-ready-on', label: 'Ready ON', group: 'Игрок', type: 'color' },
  { key: '--quizzy-player-ready-off', label: 'Ready OFF', group: 'Игрок', type: 'color' },

  { key: '--quizzy-overlay-rgb', label: 'Оверлей (цвет)', group: 'Модалки', type: 'rgb' },
  {
    key: '--quizzy-overlay-opacity',
    label: 'Оверлей (прозрачность)',
    group: 'Модалки',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
  },
]

export const TOKEN_KEYS = Array.from(new Set(TOKEN_DEFS.map((t) => t.key)))

function storageKey(theme) {
  return `${STORAGE_PREFIX}${theme}`
}

export function readTokenOverrides(theme) {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(theme))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeTokenOverride(theme, tokenKey, value) {
  if (typeof window === 'undefined') return
  const current = readTokenOverrides(theme)
  const next = { ...current, [tokenKey]: value }
  localStorage.setItem(storageKey(theme), JSON.stringify(next))
}

export function deleteTokenOverride(theme, tokenKey) {
  if (typeof window === 'undefined') return
  const current = readTokenOverrides(theme)
  if (!current || typeof current !== 'object' || !(tokenKey in current)) return
  // eslint-disable-next-line no-unused-vars
  const { [tokenKey]: _removed, ...rest } = current
  localStorage.setItem(storageKey(theme), JSON.stringify(rest))
}

export function clearTokenOverrides(theme) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(storageKey(theme))
}

export function clearInlineTokenOverrides(keys = TOKEN_KEYS) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  keys.forEach((k) => root.style.removeProperty(k))
}

function normalizeOverrides(overrides = {}) {
  const next = { ...overrides }

  if (!next['--quizzy-accent'] && next['--quizzy-gold']) next['--quizzy-accent'] = next['--quizzy-gold']
  if (!next['--quizzy-accent'] && next['--quizzy-section-label-bg']) next['--quizzy-accent'] = next['--quizzy-section-label-bg']
  if (!next['--quizzy-accent-fg'] && next['--quizzy-section-label-fg']) next['--quizzy-accent-fg'] = next['--quizzy-section-label-fg']

  delete next['--quizzy-gold']
  delete next['--quizzy-section-label-bg']
  delete next['--quizzy-section-label-fg']

  return next
}

export function applyTokenOverrides(overrides = {}) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const normalized = normalizeOverrides(overrides)
  Object.entries(normalized).forEach(([k, v]) => {
    if (!k || typeof v !== 'string') return
    root.style.setProperty(k, v)
  })
}

export function applyStoredTokenOverrides(theme) {
  const overrides = readTokenOverrides(theme)
  applyTokenOverrides(overrides)
}

export function getComputedTokenValue(tokenKey) {
  if (typeof window === 'undefined') return ''
  const v = window.getComputedStyle(document.documentElement).getPropertyValue(tokenKey)
  return String(v || '').trim()
}
