import React, { useEffect, useRef, useState } from 'react'

export default function LoadingScreen({
  message = 'Загружаем',
  subtext = '',
  fullscreen = true,
  className = '',
  visible = true,
  minDuration = 0,
} = {}) {
  const [shouldShow, setShouldShow] = useState(visible)
  const startRef = useRef(visible ? Date.now() : 0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (visible) {
      startRef.current = Date.now()
      setShouldShow(true)
      return () => {}
    }

    const elapsed = Date.now() - startRef.current
    const remaining = Math.max(0, minDuration - elapsed)
    if (remaining === 0) {
      setShouldShow(false)
      return () => {}
    }
    timerRef.current = setTimeout(() => {
      setShouldShow(false)
      timerRef.current = null
    }, remaining)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, minDuration])

  if (!shouldShow) return null

  const container = fullscreen
    ? 'fixed inset-0 z-[1200] flex items-center justify-center px-6 bg-white'
    : 'w-full h-full flex items-center justify-center px-6 py-6'

  return (
    <div className={`${container} ${className}`} aria-live="polite">
      <div className="flex flex-col items-center justify-center text-center gap-3 select-none">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-[var(--qz-blue-10)] animate-ping" />
          <div className="absolute inset-2 rounded-full border-4 border-[var(--qz-blue)] border-t-transparent animate-spin" />
          <div className="absolute inset-6 rounded-full bg-[var(--qz-yellow)] shadow-lg" />
        </div>
        <div className="text-[18px] leading-[22px] font-extrabold text-[var(--qz-text)]">{message}</div>
        {subtext ? <div className="text-sm text-[var(--qz-gray)] max-w-[260px]">{subtext}</div> : null}
      </div>
    </div>
  )
}
