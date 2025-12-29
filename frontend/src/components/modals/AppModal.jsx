import { useEffect } from 'react'
import { X } from 'lucide-react'

const VARIANTS = {
  primary: { bg: 'var(--qz-blue)', fg: 'var(--qz-white)' },
  secondary: { bg: 'var(--qz-black-5)', fg: 'var(--qz-text)' },
  danger: { bg: 'var(--qz-error)', fg: 'var(--qz-white)' },
  success: { bg: 'var(--qz-success)', fg: 'var(--qz-white)' },
}

export default function AppModal({
  open,
  onClose,
  imageSrc,
  title,
  children,
  closeOnBackdrop = true,
  primaryAction,
  secondaryAction,
} = {}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (typeof onClose === 'function') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const primary = primaryAction
  const secondary = secondaryAction

  const primaryStyle = VARIANTS[primary?.variant || 'primary'] || VARIANTS.primary
  const secondaryStyle = VARIANTS[secondary?.variant || 'secondary'] || VARIANTS.secondary

  const handleBackdrop = () => {
    if (!closeOnBackdrop) return
    if (typeof onClose === 'function') onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-3 py-6" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Закрыть"
        onClick={handleBackdrop}
        style={{ backgroundColor: 'var(--qz-black-50)' }}
      />

      <div
        className="relative bg-white rounded-[20px] shadow-2xl overflow-hidden"
        style={{ width: 'min(366px, calc(100vw - 24px))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--qz-black-5)', color: 'var(--qz-gray)' }}
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 pt-6 pb-5 max-h-[82vh] overflow-y-auto">
          {imageSrc ? (
            <img src={imageSrc} alt="" className="mx-auto w-[180px] h-auto select-none pointer-events-none" />
          ) : null}

          {title ? (
            <div className="mt-4 text-center text-[20px] leading-[26px] font-extrabold tracking-[0.1px] text-[var(--qz-text)]">
              {title}
            </div>
          ) : null}

          {children ? (
            <div className="mt-3 text-[17px] leading-[26px] text-[var(--qz-gray)] whitespace-pre-line">{children}</div>
          ) : null}

          {primary ? (
            <div className="mt-6">
              {secondary ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={secondary.onClick}
                    className="flex-1 h-[50px] rounded-[10px] text-[17px] leading-[22px] font-semibold"
                    style={{ backgroundColor: secondaryStyle.bg, color: secondaryStyle.fg }}
                  >
                    {secondary.label}
                  </button>
                  <button
                    type="button"
                    onClick={primary.onClick}
                    className="flex-1 h-[50px] rounded-[10px] text-[17px] leading-[22px] font-semibold"
                    style={{ backgroundColor: primaryStyle.bg, color: primaryStyle.fg }}
                  >
                    {primary.label}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={primary.onClick}
                  className="w-full h-[50px] rounded-[10px] text-[17px] leading-[22px] font-semibold"
                  style={{ backgroundColor: primaryStyle.bg, color: primaryStyle.fg }}
                >
                  {primary.label}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
