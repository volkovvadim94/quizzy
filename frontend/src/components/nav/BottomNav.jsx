import React from 'react'

const iconProps = (active) => ({
  stroke: 'currentColor',
  strokeWidth: 1.8,
  fill: active ? 'currentColor' : 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

function IconHome({ className, active }) {
  const props = iconProps(active)
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 10.2 11.34 4a1 1 0 0 1 1.32 0L20 10.2V19a2 2 0 0 1-2 2h-3.2a0.8 0.8 0 0 1-0.8-0.8v-3.4a1.8 1.8 0 0 0-1.8-1.8h-0.4a1.8 1.8 0 0 0-1.8 1.8v3.4a0.8 0.8 0 0 1-0.8 0.8H6A2 2 0 0 1 4 19v-8.8Z"
        {...props}
      />
    </svg>
  )
}

function IconProfile({ className, active }) {
  const props = iconProps(active)
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="4" {...props} />
      <path d="M5 19.5c0-2.9 3-4.5 7-4.5s7 1.6 7 4.5" stroke={props.stroke} strokeWidth={props.strokeWidth} fill="none" />
    </svg>
  )
}

function IconRating({ className, active }) {
  const props = iconProps(active)
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.3 4h5.4l1 3.5H20c0.5 0 0.82 0.53 0.6 1L18.4 12l2.2 3.5c0.25 0.47-0.1 1-0.62 1H4.02c-0.53 0-0.87-0.56-0.62-1.03L5.6 12 3.4 8.5c-0.28-0.47 0.05-1 0.57-1H8.3l1-3.5Z"
        {...props}
      />
    </svg>
  )
}

function IconSettings({ className, active }) {
  const props = iconProps(active)
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z"
        {...props}
      />
      <path
        d="M19.5 12.7c0.04-0.46 0.04-0.94 0-1.4l1.3-1a0.6 0.6 0 0 0 0.16-0.76l-1.5-2.7a0.6 0.6 0 0 0-0.74-0.26l-1.55 0.63a6 6 0 0 0-1.2-0.7l-0.24-1.64A0.6 0.6 0 0 0 15.14 3h-3.3a0.6 0.6 0 0 0-0.59 0.49l-0.24 1.64a6 6 0 0 0-1.2 0.7L8.27 6.58a0.6 0.6 0 0 0-0.74 0.26L6.03 9.55a0.6 0.6 0 0 0 0.16 0.76l1.3 1c-0.04 0.46-0.04 0.94 0 1.4l-1.3 1a0.6 0.6 0 0 0-0.16 0.76l1.5 2.7a0.6 0.6 0 0 0 0.74 0.26l1.55-0.63a6 6 0 0 0 1.2 0.7l0.24 1.64a0.6 0.6 0 0 0 0.59 0.49h3.3a0.6 0.6 0 0 0 0.59-0.49l0.24-1.64a6 6 0 0 0 1.2-0.7l1.55 0.63a0.6 0.6 0 0 0 0.74-0.26l1.5-2.7a0.6 0.6 0 0 0-0.16-0.76l-1.3-1Z"
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        fill="none"
      />
    </svg>
  )
}

const tabs = [
  { key: 'game', label: 'Игра', to: '/' },
  { key: 'profile', label: 'Профиль', to: '/profile' },
  { key: 'rating', label: 'Рейтинг', to: '/rating' },
  { key: 'settings', label: 'Настройки', to: '/settings' },
]

export default function BottomNav({ active = 'game', onNavigate }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-[430px]">
        <div
          className="bg-white/95 backdrop-blur rounded-t-[16px] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-[var(--qz-black-5)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
        >
          <div className="h-[84px] pt-2 flex items-start justify-around">
            {tabs.map((t) => {
              const isActive = t.key === active
              const color = isActive ? 'text-[var(--qz-text)]' : 'text-[var(--qz-gray)]'
              const weight = isActive ? 'font-bold' : 'font-medium'

              let icon = null
              if (t.key === 'game') icon = <IconHome className={`w-[22px] h-[22px] ${color}`} active={isActive} />
              if (t.key === 'profile') icon = <IconProfile className={`w-[22px] h-[22px] ${color}`} active={isActive} />
              if (t.key === 'rating') icon = <IconRating className={`w-[22px] h-[22px] ${color}`} active={isActive} />
              if (t.key === 'settings') icon = <IconSettings className={`w-[22px] h-[22px] ${color}`} active={isActive} />

              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onNavigate?.(t.to)}
                  className="w-[70px] h-[40px] flex flex-col items-center justify-start gap-1 select-none"
                >
                  <div className="h-[24px] flex items-center justify-center">{icon}</div>
                  <div className={`text-[10px] tracking-[0.2px] ${weight} ${color}`}>{t.label}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
