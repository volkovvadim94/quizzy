import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { tgTopPadding } from '../../utils/safeArea'
import { isTelegramWebApp } from '../../utils/telegram'

function BackIcon({ className } = {}) {
  return (
    <svg className={className} width="10" height="17" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.20711 0.292893C8.81658 -0.0976311 8.18342 -0.0976311 7.79289 0.292893L0.292893 7.79289C-0.0976315 8.18342 -0.0976315 8.81658 0.292893 9.20711L7.79289 16.7071C8.18342 17.0976 8.81658 17.0976 9.20711 16.7071C9.59763 16.3166 9.59763 15.6834 9.20711 15.2929L2.41421 8.5L9.20711 1.70711C9.59763 1.31658 9.59763 0.683417 9.20711 0.292893Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ExitIcon({ className } = {}) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 7V6C10 4.89543 10.8954 4 12 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H12C10.8954 20 10 19.1046 10 18V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 9L4 12L7 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SectionHeader({
  title,
  subtitle,
  backTo = '/',
  backReplace = true,
  onBack,
  right,
  topExtraPx = 0,
  backVariant = 'back', // back | exit
  hideBack = false,
} = {}) {
  const navigate = useNavigate()
  const isWebApp = useMemo(() => isTelegramWebApp(), [])
  const backButtonClass =
    backVariant === 'exit'
      ? 'w-11 h-11 flex items-center justify-center text-[var(--qz-blue)] bg-transparent hover:bg-transparent active:bg-transparent focus:outline-none active:opacity-70'
      : 'w-11 h-11 rounded-xl flex items-center justify-center text-[var(--qz-blue)] hover:bg-[var(--qz-black-5)] active:bg-[var(--qz-black-5)]'

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack()
      return
    }
    if (backTo) {
      navigate(backTo, { replace: backReplace })
      return
    }
    navigate(-1)
  }

  return (
    <div style={{ paddingTop: tgTopPadding(isWebApp, { defaultExtraPx: topExtraPx }) }}>
      <div className="h-[50px] px-3 flex items-center gap-2">
        {!hideBack ? (
          <button
            type="button"
            onClick={handleBack}
            className={backButtonClass}
            aria-label="Назад"
          >
            {backVariant === 'exit' ? <ExitIcon className="w-7 h-7" /> : <BackIcon />}
          </button>
        ) : (
          <div className="w-11 h-11" />
        )}

        <div className="flex flex-col leading-none flex-1 min-w-0">
          <div
            className={[
              subtitle
                ? 'text-[20px] leading-[26px] font-black tracking-[0.1px]'
                : 'text-[24px] leading-[26px] font-extrabold tracking-[0.1px]',
              'text-[var(--qz-text)] truncate',
            ].join(' ')}
          >
            {title}
          </div>
          {subtitle ? (
            <div className="text-[12px] leading-[26px] font-black tracking-[0.1px] text-[var(--qz-gray)] -mt-1 truncate">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  )
}
