import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

function getName(player) {
  if (!player) return 'User'
  const username = player.username || ''
  if (username) return username
  const full = `${player.firstName || ''} ${player.lastName || ''}`.trim()
  return full || 'User'
}

export default function PlayerRow({
  index = 1,
  player,
  isSelf = false,
  isOrganizer = false,
  isReady = false,
  isOnline = true,
  showReady = true,
  showTotalScore = true,
  gameScore,
  showGameScore = typeof gameScore === 'number',
  deltaText = '',
  deltaTone = 'positive',
  className = '',
} = {}) {
  const name = getName(player)
  const avatarUrl = player?.avatarUrl || ''
  const initial = (name || 'U').slice(0, 1).toUpperCase()
  const totalScore = player?.totalScore ?? 0

  const borderColor = isSelf ? 'var(--quizzy-player-row-border-self)' : 'var(--quizzy-player-row-border)'

  const [deltaKey, setDeltaKey] = useState(0)
  const prevDeltaRef = useRef(deltaText)

  useEffect(() => {
    if (!deltaText) return
    if (prevDeltaRef.current === deltaText) return
    prevDeltaRef.current = deltaText
    setDeltaKey((k) => k + 1)
  }, [deltaText])

  const deltaColor =
    deltaTone === 'negative'
      ? 'var(--quizzy-danger)'
      : deltaTone === 'neutral'
        ? 'var(--quizzy-muted)'
        : 'var(--quizzy-player-ready-on)'

  return (
    <div
      className={`flex items-center gap-4 p-4 border ${!isOnline ? 'grayscale' : ''} ${className}`}
      style={{
        backgroundColor: 'var(--quizzy-player-row-bg)',
        borderColor,
        borderRadius: 'var(--quizzy-player-row-radius)',
        opacity: isOnline ? 1 : 'var(--quizzy-player-row-offline-opacity)',
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 tabular-nums"
        style={{
          background: 'var(--quizzy-player-index-bg)',
          boxShadow: 'inset 0 0 0 1px var(--quizzy-player-index-border)',
          color: 'var(--quizzy-text)',
        }}
        title={`#${index}`}
      >
        {index}
      </div>

      <div className="relative shrink-0">
        <div className="avatar">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="rounded-full object-cover w-full h-full" />
            ) : (
              <span className="text-sm font-bold">{initial}</span>
            )}
          </div>
        </div>
        {isOrganizer ? (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs leading-none" aria-label="Организатор" title="Организатор">
            ⭐
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate" style={{ color: 'var(--quizzy-text)' }}>
          {name}
        </div>
        {showTotalScore ? (
          <div className="text-sm flex items-center gap-1" style={{ color: 'var(--quizzy-accent)' }}>
            <span aria-hidden>🏆</span>
            <span>{totalScore}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {showGameScore ? (
          <div className="relative text-right">
            {deltaText ? (
              <div key={deltaKey} className="absolute -top-5 right-0 text-sm font-bold score-delta" style={{ color: deltaColor }}>
                {deltaText}
              </div>
            ) : null}
            <div className="text-2xl font-black leading-none tabular-nums" style={{ color: 'var(--quizzy-text)' }}>
              {typeof gameScore === 'number' ? gameScore : 0}
            </div>
          </div>
        ) : null}

        {showReady ? (
          <div className="flex items-center justify-center">
            <CheckCircle2 size={20} style={{ color: isReady ? 'var(--quizzy-player-ready-on)' : 'var(--quizzy-player-ready-off)' }} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

