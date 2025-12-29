import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TOKEN_DEFS,
  TOKEN_KEYS,
  applyStoredTokenOverrides,
  clearInlineTokenOverrides,
  clearTokenOverrides,
  deleteTokenOverride,
  getComputedTokenValue,
  writeTokenOverride,
} from '../theme/tokens'
import PlayerRow from '../components/players/PlayerRow'
import TopicCard from '../components/topics/TopicCard'
import LoginCardPreview from '../components/themelab/LoginCardPreview'
import RoomJoinPreview from '../components/themelab/RoomJoinPreview'

function clampNumber(n, min, max) {
  const x = Number(n)
  if (Number.isNaN(x)) return min
  return Math.max(min, Math.min(max, x))
}

function parseHexColor(value) {
  const v = String(value || '').trim()
  if (!v) return null
  if (v.toLowerCase() === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const raw = v.startsWith('#') ? v.slice(1) : v
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    return { r, g, b, a: 1 }
  }
  if (raw.length === 6 || raw.length === 8) {
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1
    if ([r, g, b].some((x) => Number.isNaN(x))) return null
    return { r, g, b, a: Number.isFinite(a) ? a : 1 }
  }
  return null
}

function parseRgbFunc(value) {
  const v = String(value || '').trim()
  if (!v) return null
  const m = v.match(/^rgba?\((.+)\)$/i)
  if (m) {
    const parts = m[1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const r = Number(parts[0])
    const g = Number(parts[1])
    const b = Number(parts[2])
    const a = parts.length >= 4 ? Number(parts[3]) : 1
    if ([r, g, b].some((x) => Number.isNaN(x))) return null
    return { r, g, b, a: Number.isFinite(a) ? a : 1 }
  }

  // Modern syntax: rgb(0 0 0 / 0.2)
  const m2 = v.match(/^rgb\((.+)\)$/i)
  if (m2) {
    const body = m2[1].trim()
    const [left, alphaPart] = body.split('/').map((s) => s.trim())
    const nums = left.split(/\s+/).map((p) => Number(p))
    if (nums.length < 3) return null
    const [r, g, b] = nums
    let a = 1
    if (alphaPart) {
      const maybePct = alphaPart.endsWith('%')
      const n = Number(alphaPart.replace('%', ''))
      if (!Number.isNaN(n)) a = maybePct ? n / 100 : n
    }
    if ([r, g, b].some((x) => Number.isNaN(x))) return null
    return { r, g, b, a: Number.isFinite(a) ? a : 1 }
  }

  return null
}

function hexToRgbParts(hex) {
  const h = String(hex || '').trim().replace(/^#/, '')
  if (h.length !== 6) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return { r, g, b }
}

function rgbPartsToHex({ r, g, b }) {
  const to2 = (v) => String(Math.max(0, Math.min(255, Math.round(v))).toString(16)).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

function parseColorToRgba(value) {
  return parseHexColor(value) || parseRgbFunc(value)
}

function parseRgbParts(value) {
  const v = String(value || '').trim()
  const parts = v.split(/\s+/).map((p) => Number(p))
  if (parts.length < 3) return null
  const [r, g, b] = parts
  if ([r, g, b].some((x) => Number.isNaN(x))) return null
  return { r, g, b }
}

function parseRgbTriplet(value) {
  const triplet = parseRgbParts(value)
  if (triplet) return triplet
  const rgba = parseColorToRgba(value)
  if (!rgba) return null
  return { r: rgba.r, g: rgba.g, b: rgba.b }
}

function groupedTokens(defs) {
  const groups = new Map()
  defs.forEach((d) => {
    const g = d.group || 'Другое'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(d)
  })
  return Array.from(groups.entries())
}

function Section({ title, subtitle, children }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex flex-col gap-1">
        <div className="font-semibold">{title}</div>
        {subtitle ? <div className="text-sm opacity-70">{subtitle}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function ControlRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm opacity-80">{label}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function TokenEditor({ tokenKeys, defsByKey, values, setToken, unsetToken }) {
  return (
    <div className="flex flex-col gap-3">
      {tokenKeys.map((key) => {
        const t = defsByKey.get(key) || { key, label: key, type: 'color' }

        if (t.type === 'range') {
          const raw = String(values[t.key] ?? '').trim()
          const num = raw.replace(String(t.unit || ''), '')
          const current = clampNumber(num, t.min ?? 0, t.max ?? 1)
          const display = Number.isFinite(t.step) && t.step >= 1 ? String(Math.round(current)) : current.toFixed(2)

          return (
            <div key={t.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm" title={t.key}>
                  {t.label}
                </div>
                <div className="text-xs opacity-70 tabular-nums">
                  {display}
                  {t.unit || ''}
                </div>
              </div>
              <input
                type="range"
                min={t.min}
                max={t.max}
                step={t.step}
                value={current}
                onChange={(e) => setToken(t.key, `${clampNumber(e.target.value, t.min ?? 0, t.max ?? 1)}${t.unit || ''}`)}
              />
              <div className="flex items-center justify-end gap-2">
                <button className="btn btn-ghost btn-xs" onClick={() => unsetToken(t.key)}>
                  Unset
                </button>
              </div>
            </div>
          )
        }

        if (t.type === 'rgb') {
          const parts = parseRgbTriplet(values[t.key]) || { r: 0, g: 0, b: 0 }
          const hex = rgbPartsToHex(parts)
          return (
            <div key={t.key} className="flex items-center justify-between gap-3">
              <div className="text-sm" title={t.key}>
                {t.label}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => {
                    const next = hexToRgbParts(e.target.value)
                    if (!next) return
                    setToken(t.key, `${next.r} ${next.g} ${next.b}`)
                  }}
                />
                <input className="input input-sm w-36" value={values[t.key] ?? ''} onChange={(e) => setToken(t.key, e.target.value)} />
                <button className="btn btn-ghost btn-xs" onClick={() => unsetToken(t.key)}>
                  Unset
                </button>
              </div>
            </div>
          )
        }

        const rgba = parseColorToRgba(values[t.key]) || { r: 0, g: 0, b: 0, a: 1 }
        const hex = rgbPartsToHex(rgba)
        const alpha = clampNumber(rgba.a, 0, 1)

        return (
          <div key={t.key} className="flex items-center justify-between gap-3">
            <div className="text-sm" title={t.key}>
              {t.label}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hex}
                onChange={(e) => {
                  const parts = hexToRgbParts(e.target.value)
                  if (!parts) return
                  setToken(t.key, `rgb(${parts.r} ${parts.g} ${parts.b} / ${alpha})`)
                }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={alpha}
                onChange={(e) => {
                  const a = clampNumber(e.target.value, 0, 1)
                  setToken(t.key, `rgb(${rgba.r} ${rgba.g} ${rgba.b} / ${a})`)
                }}
                title="Alpha"
              />
              <input className="input input-sm w-28" value={values[t.key] ?? ''} onChange={(e) => setToken(t.key, e.target.value)} />
              <button className="btn btn-ghost btn-xs" onClick={() => setToken(t.key, 'transparent')} title="Сделать прозрачным">
                0
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => unsetToken(t.key)}>
                Unset
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ThemeLab() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState('quizzyDark')
  const [values, setValues] = useState({})
  const [showAllTokens, setShowAllTokens] = useState(false)

  const defsByKey = useMemo(() => new Map(TOKEN_DEFS.map((d) => [d.key, d])), [])
  const groups = useMemo(() => groupedTokens(TOKEN_DEFS), [])

  const [loginState, setLoginState] = useState({
    title: 'Войти',
    primaryText: '',
    secondaryText: 'Нажми кнопку и авторизуйся через Telegram.',
    buttonText: 'Войти через Telegram',
    disabled: false,
    showSecondaryText: true,
    showPrimaryText: false,
  })

  const [roomJoinState, setRoomJoinState] = useState({
    value: '',
    placeholder: 'Введи код комнаты',
    buttonText: 'Войти',
    disabled: false,
  })

  const [topicState, setTopicState] = useState({
    title: 'География',
    imageUrl: '',
    useDefaultImage: true,
    showOverlay: true,
  })

  const [playerState, setPlayerState] = useState({
    isSelf: true,
    isOrganizer: true,
    isReady: true,
    isOnline: true,
    showReady: true,
    showTotalScore: true,
    gameScore: 120,
    showGameScore: true,
    deltaText: '+10',
    deltaTone: 'positive',
  })

  const [lobbyPreview, setLobbyPreview] = useState({
    isOrganizer: true,
    ready: true,
    canStart: true,
  })

  const [gamePreview, setGamePreview] = useState({
    phase: 'question', // question | reveal
    selected: 1,
    correct: 2,
  })

  useEffect(() => {
    const root = document.documentElement
    const prevTheme = root.getAttribute('data-theme') || 'quizzyDark'
    const initialTheme = prevTheme === 'quizzyLight' ? 'quizzyLight' : 'quizzyDark'
    setTheme(initialTheme)

    return () => {
      root.setAttribute('data-theme', prevTheme)
      clearInlineTokenOverrides()
      applyStoredTokenOverrides(prevTheme)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    clearInlineTokenOverrides()
    applyStoredTokenOverrides(theme)

    const next = {}
    TOKEN_KEYS.forEach((k) => {
      next[k] = getComputedTokenValue(k)
    })
    setValues(next)
  }, [theme])

  const setToken = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    document.documentElement.style.setProperty(key, value)
    writeTokenOverride(theme, key, value)
  }

  const unsetToken = (key) => {
    deleteTokenOverride(theme, key)
    document.documentElement.style.removeProperty(key)
    setValues((prev) => ({ ...prev, [key]: getComputedTokenValue(key) }))
  }

  const exportCss = () => {
    const lines = TOKEN_KEYS.map((k) => `  ${k}: ${getComputedTokenValue(k)};`).join('\n')
    return `[data-theme="${theme}"] {\n${lines}\n}\n`
  }

  const handleReset = () => {
    clearTokenOverrides(theme)
    clearInlineTokenOverrides()
    applyStoredTokenOverrides(theme)
    const next = {}
    TOKEN_KEYS.forEach((k) => {
      next[k] = getComputedTokenValue(k)
    })
    setValues(next)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore (some browsers/contexts block clipboard)
    }
  }

  return (
    <div className="scroll-mask flex-1 min-h-0">
      <div className="flex flex-col gap-4 pb-6">
        <div className="glass-card rounded-2xl p-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-bold">ThemeLab</div>
          <div className="text-sm opacity-70">Настраиваем токены палитры и витрину компонентов (превью + контролы).</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
            На главную
          </button>
        </div>
      </div>

      <Section title="Настройки" subtitle="Тема и быстрые действия (только внутри ThemeLab).">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm opacity-70">Тема</div>
            <div className="join">
              <button className={`btn btn-sm join-item ${theme === 'quizzyDark' ? 'btn-primary' : ''}`} onClick={() => setTheme('quizzyDark')}>
                Dark
              </button>
              <button className={`btn btn-sm join-item ${theme === 'quizzyLight' ? 'btn-primary' : ''}`} onClick={() => setTheme('quizzyLight')}>
                Light
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="btn btn-sm" onClick={handleReset}>
              Сброс
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => copyToClipboard(exportCss())}>
              Copy CSS
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowAllTokens((v) => !v)}>
              {showAllTokens ? 'Скрыть все токены' : 'Показать все токены'}
            </button>
          </div>
          <div className="text-xs opacity-60 leading-relaxed">
            Хранится в localStorage: <span className="font-mono">quizzy:tokenOverrides:&lt;theme&gt;</span>
          </div>
        </div>
      </Section>

      <Section title="Шапка" subtitle="Превью шапки уже видно сверху, тут только токены.">
        <TokenEditor
          defsByKey={defsByKey}
          values={values}
          setToken={setToken}
          unsetToken={unsetToken}
          tokenKeys={['--quizzy-header-bg', '--quizzy-tg-header-bg', '--quizzy-header-border']}
        />
      </Section>

      <Section title="Метки блоков" subtitle="Жёлтые плашки «Подключиться/Создать игру» на Home.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="flex items-center justify-start">
            <div className="section-label px-3 py-1 rounded-full text-xs font-bold uppercase">Подключиться</div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={['--quizzy-accent', '--quizzy-accent-fg']}
            />
          </div>
        </div>
      </Section>

      <Section title="Попап входа" subtitle="Статика для подбора палитры (кнопка/текст/фон).">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="flex justify-center md:justify-start">
            <LoginCardPreview {...loginState} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Состояние</div>
            <ControlRow label="Заголовок">
              <input className="input input-sm w-56" value={loginState.title} onChange={(e) => setLoginState((s) => ({ ...s, title: e.target.value }))} />
            </ControlRow>
            <ControlRow label="Текст кнопки">
              <input
                className="input input-sm w-56"
                value={loginState.buttonText}
                onChange={(e) => setLoginState((s) => ({ ...s, buttonText: e.target.value }))}
              />
            </ControlRow>
            <ControlRow label="Кнопка disabled">
              <input type="checkbox" className="toggle" checked={loginState.disabled} onChange={(e) => setLoginState((s) => ({ ...s, disabled: e.target.checked }))} />
            </ControlRow>
            <ControlRow label="Primary текст">
              <input
                type="checkbox"
                className="toggle"
                checked={loginState.showPrimaryText}
                onChange={(e) => setLoginState((s) => ({ ...s, showPrimaryText: e.target.checked }))}
              />
              <input
                className="input input-sm w-56"
                value={loginState.primaryText}
                onChange={(e) => setLoginState((s) => ({ ...s, primaryText: e.target.value }))}
                placeholder="(пусто)"
              />
            </ControlRow>
            <ControlRow label="Secondary текст">
              <input
                type="checkbox"
                className="toggle"
                checked={loginState.showSecondaryText}
                onChange={(e) => setLoginState((s) => ({ ...s, showSecondaryText: e.target.checked }))}
              />
              <input className="input input-sm w-56" value={loginState.secondaryText} onChange={(e) => setLoginState((s) => ({ ...s, secondaryText: e.target.value }))} />
            </ControlRow>

            <div className="font-semibold pt-2">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={['--quizzy-surface', '--quizzy-text', '--quizzy-muted', '--quizzy-primary', '--quizzy-btn-fg']}
            />
            <div className="text-xs opacity-60">Здесь только общие токены (в будущем можно выделить отдельные для попапа).</div>
          </div>
        </div>
      </Section>

      <Section title="Подключение к комнате" subtitle="Кастомный инпут + кнопка «Войти».">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <RoomJoinPreview
            value={roomJoinState.value}
            onChange={(v) => setRoomJoinState((s) => ({ ...s, value: v }))}
            placeholder={roomJoinState.placeholder}
            buttonText={roomJoinState.buttonText}
            disabled={roomJoinState.disabled}
          />
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Состояние</div>
            <ControlRow label="Placeholder">
              <input className="input input-sm w-56" value={roomJoinState.placeholder} onChange={(e) => setRoomJoinState((s) => ({ ...s, placeholder: e.target.value }))} />
            </ControlRow>
            <ControlRow label="Текст кнопки">
              <input className="input input-sm w-56" value={roomJoinState.buttonText} onChange={(e) => setRoomJoinState((s) => ({ ...s, buttonText: e.target.value }))} />
            </ControlRow>
            <ControlRow label="Disabled">
              <input type="checkbox" className="toggle" checked={roomJoinState.disabled} onChange={(e) => setRoomJoinState((s) => ({ ...s, disabled: e.target.checked }))} />
            </ControlRow>

            <div className="font-semibold pt-2">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={[
                '--quizzy-surface-2',
                '--quizzy-room-input-bg',
                '--quizzy-muted',
                '--quizzy-placeholder',
                '--quizzy-focus-ring',
                '--quizzy-room-join-btn-bg',
                '--quizzy-room-join-btn-fg',
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Карточка темы" subtitle="Должна совпадать с тем, что в Home (список тем).">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="w-full max-w-[360px]">
            <TopicCard title={topicState.title} imageUrl={topicState.imageUrl} useDefaultImage={topicState.useDefaultImage} showOverlay={topicState.showOverlay} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Состояние</div>
            <ControlRow label="Заголовок">
              <input className="input input-sm w-56" value={topicState.title} onChange={(e) => setTopicState((s) => ({ ...s, title: e.target.value }))} />
            </ControlRow>
            <ControlRow label="Overlay">
              <input type="checkbox" className="toggle" checked={topicState.showOverlay} onChange={(e) => setTopicState((s) => ({ ...s, showOverlay: e.target.checked }))} />
            </ControlRow>
            <ControlRow label="Дефолтная картинка">
              <input
                type="checkbox"
                className="toggle"
                checked={topicState.useDefaultImage}
                onChange={(e) => setTopicState((s) => ({ ...s, useDefaultImage: e.target.checked }))}
              />
            </ControlRow>

            <div className="font-semibold pt-2">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={[
                '--quizzy-topic-card-bg',
                '--quizzy-topic-card-title',
                '--quizzy-topic-card-radius',
                '--quizzy-topic-card-overlay-rgb',
                '--quizzy-topic-card-overlay-alpha-top',
                '--quizzy-topic-card-overlay-alpha-bottom',
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Плашка игрока" subtitle="Цель - один компонент для всех экранов (пока точно используется в Room).">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="flex flex-col gap-2">
            <PlayerRow
              index={1}
              player={{ username: 'Player One', totalScore: 123, firstName: 'Player', lastName: 'One' }}
              isSelf={playerState.isSelf}
              isOrganizer={playerState.isOrganizer}
              isReady={playerState.isReady}
              isOnline={playerState.isOnline}
              showReady={playerState.showReady}
              showTotalScore={playerState.showTotalScore}
              gameScore={playerState.gameScore}
              showGameScore={playerState.showGameScore}
              deltaText={playerState.deltaText}
              deltaTone={playerState.deltaTone}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Состояние</div>
            <ControlRow label="Я (border self)">
              <input type="checkbox" className="toggle" checked={playerState.isSelf} onChange={(e) => setPlayerState((s) => ({ ...s, isSelf: e.target.checked }))} />
            </ControlRow>
            <ControlRow label="Организатор">
              <input
                type="checkbox"
                className="toggle"
                checked={playerState.isOrganizer}
                onChange={(e) => setPlayerState((s) => ({ ...s, isOrganizer: e.target.checked }))}
              />
            </ControlRow>
            <ControlRow label="Ready">
              <input type="checkbox" className="toggle" checked={playerState.isReady} onChange={(e) => setPlayerState((s) => ({ ...s, isReady: e.target.checked }))} />
            </ControlRow>
            <ControlRow label="Онлайн">
              <input type="checkbox" className="toggle" checked={playerState.isOnline} onChange={(e) => setPlayerState((s) => ({ ...s, isOnline: e.target.checked }))} />
            </ControlRow>
            <ControlRow label="Показывать Ready">
              <input type="checkbox" className="toggle" checked={playerState.showReady} onChange={(e) => setPlayerState((s) => ({ ...s, showReady: e.target.checked }))} />
            </ControlRow>
            <ControlRow label="Показывать счёт">
              <input
                type="checkbox"
                className="toggle"
                checked={playerState.showTotalScore}
                onChange={(e) => setPlayerState((s) => ({ ...s, showTotalScore: e.target.checked }))}
              />
            </ControlRow>
            <ControlRow label="Счёт матча">
              <input
                type="checkbox"
                className="toggle"
                checked={playerState.showGameScore}
                onChange={(e) => setPlayerState((s) => ({ ...s, showGameScore: e.target.checked }))}
              />
              <input
                className="input input-sm w-24"
                value={String(playerState.gameScore ?? '')}
                onChange={(e) => setPlayerState((s) => ({ ...s, gameScore: Number(e.target.value || 0) }))}
                inputMode="numeric"
              />
            </ControlRow>
            <ControlRow label="Дельта (анимация)">
              <input
                className="input input-sm w-24"
                value={playerState.deltaText}
                onChange={(e) => setPlayerState((s) => ({ ...s, deltaText: e.target.value }))}
                placeholder="+10"
              />
              <select
                className="select select-sm w-32"
                value={playerState.deltaTone}
                onChange={(e) => setPlayerState((s) => ({ ...s, deltaTone: e.target.value }))}
              >
                <option value="positive">positive</option>
                <option value="neutral">neutral</option>
                <option value="negative">negative</option>
              </select>
            </ControlRow>

            <div className="font-semibold pt-2">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={[
                '--quizzy-player-row-bg',
                '--quizzy-player-row-border',
                '--quizzy-player-row-border-self',
                '--quizzy-player-row-radius',
                '--quizzy-player-row-offline-opacity',
                '--quizzy-player-ready-on',
                '--quizzy-player-ready-off',
                '--quizzy-accent',
                '--quizzy-border',
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Лобби (экран комнаты)" subtitle="Кнопки + список игроков (как в Room).">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="card glass-card shadow-2xl border border-base-300/60 relative overflow-visible w-full max-w-[600px]">
            <div className="section-label absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase pointer-pass">Игроки 2/3</div>
            <div className="card-body pt-8 pb-6 px-6 flex flex-col gap-3">
              <div className="flex gap-3">
                <button className="btn btn-black flex-1 h-11 font-semibold inline-flex items-center justify-center gap-2">
                  Выйти
                </button>
                <button
                  className="btn flex-1 h-11 font-semibold inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: lobbyPreview.ready ? 'var(--quizzy-player-ready-on)' : 'var(--quizzy-player-ready-off)' }}
                  onClick={() => setLobbyPreview((s) => ({ ...s, ready: !s.ready }))}
                  type="button"
                >
                  {lobbyPreview.ready ? 'Готов' : 'Готов?'}
                </button>
              </div>
              {lobbyPreview.isOrganizer ? (
                <button className={`btn btn-primary w-full ${!lobbyPreview.canStart ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!lobbyPreview.canStart}>
                  Старт
                </button>
              ) : null}

              <div className="flex flex-col gap-2 pt-2">
                <PlayerRow
                  index={1}
                  player={{ username: 'You', totalScore: 999 }}
                  isSelf
                  isOrganizer={lobbyPreview.isOrganizer}
                  isReady={lobbyPreview.ready}
                  showGameScore={false}
                />
                <PlayerRow index={2} player={{ username: 'Player Two', totalScore: 77 }} isReady showGameScore={false} />
                <PlayerRow index={3} player={{ username: 'Offline Guy', totalScore: 5 }} isReady={false} isOnline={false} showGameScore={false} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="font-semibold">Состояние</div>
            <ControlRow label="Я организатор">
              <input
                type="checkbox"
                className="toggle"
                checked={lobbyPreview.isOrganizer}
                onChange={(e) => setLobbyPreview((s) => ({ ...s, isOrganizer: e.target.checked }))}
              />
            </ControlRow>
            <ControlRow label="Можно стартовать">
              <input
                type="checkbox"
                className="toggle"
                checked={lobbyPreview.canStart}
                onChange={(e) => setLobbyPreview((s) => ({ ...s, canStart: e.target.checked }))}
              />
            </ControlRow>
            <div className="font-semibold pt-2">Токены</div>
            <TokenEditor defsByKey={defsByKey} values={values} setToken={setToken} unsetToken={unsetToken} tokenKeys={['--quizzy-accent', '--quizzy-accent-fg', '--quizzy-player-ready-on', '--quizzy-player-ready-off']} />
          </div>
        </div>
      </Section>

      <Section title="Игра" subtitle="Вопрос + варианты ответов + пример скорборда.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="card glass-card shadow-2xl border border-base-300/60 w-full max-w-[600px]">
            <div className="card-body px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-q3">Вопрос 1 из 10</span>
                <div className="px-3 py-1 rounded-full text-sm font-black tabular-nums" style={{ background: 'var(--quizzy-pill-bg)', color: 'var(--quizzy-text)' }}>
                  12
                </div>
              </div>
              <div className="text-xl font-bold leading-snug">Какая столица у Австралии?</div>

              <div className="flex flex-col gap-2">
                {['Сидней', 'Мельбурн', 'Канберра', 'Перт'].map((opt, i) => {
                  const idx = i + 1
                  const selected = gamePreview.selected === idx
                  const isReveal = gamePreview.phase === 'reveal'
                  const isCorrect = gamePreview.correct === idx

                  const bg = selected ? 'var(--quizzy-surface-2)' : 'var(--quizzy-surface)'
                  const outline = isReveal && isCorrect ? 'var(--quizzy-player-ready-on)' : selected ? 'var(--quizzy-border)' : 'transparent'

                  return (
                    <button
                      key={opt}
                      className="answer-option w-full text-left px-4 py-3 rounded-2xl"
                      style={{ background: bg, outline: `2px solid ${outline}`, outlineOffset: '-2px' }}
                      onClick={() => setGamePreview((s) => ({ ...s, selected: idx }))}
                      type="button"
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <PlayerRow index={1} player={{ username: 'You', totalScore: 999 }} isSelf gameScore={120} deltaText={gamePreview.phase === 'reveal' ? '+20' : ''} showReady={false} />
                <PlayerRow index={2} player={{ username: 'Player Two', totalScore: 77 }} gameScore={80} showReady={false} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="font-semibold">Состояние</div>
            <ControlRow label="Фаза">
              <select className="select select-sm w-40" value={gamePreview.phase} onChange={(e) => setGamePreview((s) => ({ ...s, phase: e.target.value }))}>
                <option value="question">question</option>
                <option value="reveal">reveal</option>
              </select>
            </ControlRow>
            <ControlRow label="Выбранный вариант">
              <input className="input input-sm w-24" value={String(gamePreview.selected)} onChange={(e) => setGamePreview((s) => ({ ...s, selected: Number(e.target.value || 1) }))} inputMode="numeric" />
            </ControlRow>
            <ControlRow label="Правильный вариант">
              <input className="input input-sm w-24" value={String(gamePreview.correct)} onChange={(e) => setGamePreview((s) => ({ ...s, correct: Number(e.target.value || 1) }))} inputMode="numeric" />
            </ControlRow>

            <div className="font-semibold pt-2">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={[
                '--quizzy-surface',
                '--quizzy-surface-2',
                '--quizzy-text',
                '--quizzy-muted',
                '--quizzy-pill-bg',
                '--quizzy-border',
                '--quizzy-option-bg',
                '--quizzy-option-text',
                '--quizzy-primary',
                '--quizzy-success',
                '--quizzy-danger',
                '--quizzy-player-ready-on',
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Кнопки" subtitle="Базовые варианты (квадратная/скруглённая/ghost и т.п.).">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="flex flex-wrap gap-2">
            <button className="btn">Base</button>
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-danger">Danger</button>
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={[
                '--quizzy-btn-bg',
                '--quizzy-btn-fg',
                '--quizzy-btn-primary-fg',
                '--quizzy-btn-secondary-fg',
                '--quizzy-ghost-fg',
                '--quizzy-border',
                '--quizzy-primary',
                '--quizzy-secondary',
                '--quizzy-danger',
                '--quizzy-success',
                '--quizzy-exit-btn-bg',
                '--quizzy-exit-btn-fg',
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Модалки / оверлей" subtitle="Фон затемнения и контраст модального окна.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="rounded-2xl p-4" style={{ background: 'rgb(var(--quizzy-overlay-rgb) / var(--quizzy-overlay-opacity))' }}>
            <div className="card bg-base-100 p-4">
              <div className="font-semibold">Modal box</div>
              <div className="text-sm opacity-70">Проверяем прозрачность/контраст.</div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-semibold">Токены</div>
            <TokenEditor
              defsByKey={defsByKey}
              values={values}
              setToken={setToken}
              unsetToken={unsetToken}
              tokenKeys={['--quizzy-overlay-rgb', '--quizzy-overlay-opacity', '--quizzy-surface', '--quizzy-text', '--quizzy-muted']}
            />
          </div>
        </div>
      </Section>

      {showAllTokens ? (
        <Section title="Все токены" subtitle="Полный список (на случай если чего-то нет в блоках выше).">
          <div className="flex flex-col gap-4">
            {groups.map(([groupName, defs]) => (
              <div key={groupName} className="flex flex-col gap-2">
                <div className="text-sm font-semibold opacity-80">{groupName}</div>
                <TokenEditor defsByKey={defsByKey} values={values} setToken={setToken} unsetToken={unsetToken} tokenKeys={defs.map((d) => d.key)} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

        <Section title="CSS экспорт" subtitle="Удобно, чтобы переносить результат в `globals.css` после настройки.">
          <textarea className="textarea w-full h-48 font-mono text-xs" readOnly value={exportCss()} />
        </Section>
      </div>
    </div>
  )
}
