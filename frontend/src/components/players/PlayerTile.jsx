import { useEffect, useMemo, useRef, useState } from 'react'

const palette = {
  primary: 'var(--qz-blue)',
  primary10: 'var(--qz-blue-10)',
  text: 'var(--qz-text)',
  muted: 'var(--qz-gray)',
  yellow: 'var(--qz-yellow)',
  success: 'var(--qz-success)',
  error: 'var(--qz-error)',
  border: 'var(--qz-black-5)',
  white: 'var(--qz-white)',
}

function formatNumber(value) {
  const n = Number(value || 0)
  return new Intl.NumberFormat('ru-RU').format(Number.isFinite(n) ? n : 0)
}

function getDisplayName(player) {
  if (!player) return 'Игрок'
  if (player.username) return player.username
  const first = player.firstName || ''
  const last = player.lastName || ''
  const full = `${first} ${last}`.trim()
  return full || 'Игрок'
}

function getTierLabel() {
  return 'Геймер V'
}

function CheckBadge({ checked, tone = 'blue' } = {}) {
  const isChecked = !!checked
  const filledBg = tone === 'gray' ? palette.muted : palette.primary
  const idleBg = tone === 'gray' ? palette.border : palette.primary10
  const fg = palette.white

  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: isChecked ? filledBg : idleBg }}
      aria-label={isChecked ? 'Готов' : 'Не готов'}
      title={isChecked ? 'Готов' : 'Не готов'}
    >
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M4.8 9.2L0.8 5.2C0.5 4.9 0.5 4.4 0.8 4.1C1.1 3.8 1.6 3.8 1.9 4.1L4.8 7L12.1 0.7C12.4 0.4 12.9 0.4 13.2 0.7C13.5 1 13.5 1.5 13.2 1.8L5.3 9.2C5 9.5 4.5 9.5 4.8 9.2Z"
          fill={fg}
        />
      </svg>
    </div>
  )
}

function Crown() {
  return (
    <div
      className="absolute -top-2 left-1/2 -translate-x-1/2 text-[12px] leading-none"
      aria-label="Организатор"
      title="Организатор"
    >
      👑
    </div>
  )
}

export default function PlayerTile({
  mode = 'room', // room | game
  index,
  player,
  isOnline = true,
  isSelf = false,
  isOrganizer = false,
  isReady = false,
  showReady = mode === 'room',
  showMetaOverride = null,
  showTier = true,
  showIndexOverride = null,
  gameScore,
  scoreDisplayOverride = null,
  scoreTone = 'neutral', // neutral | success | danger
  animateScore = false,
  avatarBorderColor = null,
  deltaText = '',
  deltaTone = 'positive', // positive | neutral | negative
} = {}) {
  const name = useMemo(() => getDisplayName(player), [player])
  const avatarUrl = player?.avatarUrl || ''
  const totalScore = player?.totalScore ?? 0
  const tierLabel = player?.tierLabel || getTierLabel(totalScore)
  const showMeta = typeof showMetaOverride === 'boolean' ? showMetaOverride : mode !== 'game'

  const avatarBorder = avatarBorderColor ?? (!isOnline ? palette.border : isSelf ? palette.yellow : palette.primary)

  const [deltaKey, setDeltaKey] = useState(0)
  const prevDeltaRef = useRef(deltaText)

  useEffect(() => {
    if (!deltaText) return
    if (prevDeltaRef.current === deltaText) return
    prevDeltaRef.current = deltaText
    setDeltaKey((k) => k + 1)
  }, [deltaText])

  const deltaColor = deltaTone === 'negative' ? palette.error : deltaTone === 'neutral' ? palette.muted : palette.success

  const textTone = isOnline ? palette.text : palette.muted
  const subTone = isOnline ? palette.primary : palette.muted
  const scoreToneBase = isOnline ? palette.yellow : palette.muted

  const showIndex = typeof showIndexOverride === 'boolean' ? showIndexOverride : mode === 'game'
  const indexLabel = typeof index === 'number' && Number.isFinite(index) ? String(index) : ''

  const [displayedScore, setDisplayedScore] = useState(gameScore ?? 0)
  const prevScoreRef = useRef(gameScore ?? 0)

  useEffect(() => {
    if (scoreDisplayOverride !== null && scoreDisplayOverride !== undefined) return
    const target = Number(gameScore ?? 0)
    const prev = prevScoreRef.current
    if (!animateScore) {
      prevScoreRef.current = target
      setDisplayedScore(target)
      return
    }
    if (Number.isNaN(target)) return
    if (target === prev) return
    prevScoreRef.current = target
    const steps = 10
    const duration = 200
    const stepTime = Math.max(10, Math.floor(duration / steps))
    const delta = target - prev
    let currentStep = 0
    const timer = setInterval(() => {
      currentStep += 1
      const next = Math.round(prev + (delta * currentStep) / steps)
      setDisplayedScore(currentStep >= steps ? target : next)
      if (currentStep >= steps) clearInterval(timer)
    }, stepTime)
    return () => clearInterval(timer)
  }, [gameScore, animateScore, scoreDisplayOverride])

  return (
    <div className="w-full flex items-center gap-3 py-3 min-h-[68px]">
      {showIndex ? (
        <div className="w-8 text-[28px] leading-none font-semibold tabular-nums text-[var(--qz-text)] text-center">{indexLabel}</div>
      ) : null}

      <div className="relative shrink-0">
        <div className="w-[44px] h-[44px] rounded-full p-[2px]" style={{ backgroundColor: avatarBorder }}>
          <div className="w-full h-full rounded-full overflow-hidden" style={{ backgroundColor: palette.border }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className={`w-full h-full object-cover ${isOnline ? '' : 'grayscale'}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold" style={{ color: palette.text }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        {isOrganizer ? <Crown /> : null}
      </div>

      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="text-[17px] leading-[22px] font-semibold truncate" style={{ color: textTone }}>
          {name}
        </div>
        {showMeta ? (
          <div className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold min-w-0">
            <span className="flex items-center gap-1 shrink-0" style={{ color: scoreTone }}>
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 21h8" />
                <path d="M12 17v4" />
                <path d="M7 4h10v8a5 5 0 0 1-10 0V4Z" />
                <path d="M5 5H3v3a4 4 0 0 0 4 4" />
                <path d="M19 5h2v3a4 4 0 0 1-4 4" />
              </svg>
              <span className="tabular-nums">{formatNumber(totalScore)}</span>
            </span>
            {showTier ? (
              <>
                <span className="shrink-0 text-[var(--qz-gray)]">/</span>
                <span className="truncate" style={{ color: subTone }}>
                  {tierLabel}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === 'game' ? (
        <div className="relative shrink-0 text-right pr-1">
          <div
            className="text-[34px] leading-none font-semibold tabular-nums"
            style={{ color: scoreDisplayOverride !== null && scoreDisplayOverride !== undefined ? palette.success : scoreTone === 'success' ? palette.success : scoreTone === 'danger' ? palette.error : scoreToneBase }}
          >
            {scoreDisplayOverride !== null && scoreDisplayOverride !== undefined
              ? scoreDisplayOverride
              : typeof displayedScore === 'number'
              ? displayedScore
              : typeof gameScore === 'number'
              ? gameScore
              : 0}
          </div>
        </div>
      ) : null}

      {showReady ? <CheckBadge checked={!!isReady} tone={isOnline ? 'blue' : 'gray'} /> : null}
    </div>
  )
}
