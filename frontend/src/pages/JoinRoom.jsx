import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import RoomCodeInput from '../components/room/RoomCodeInput'
import SectionHeader from '../components/layout/SectionHeader'

function sanitizeCode(value) {
  return String(value).replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 6)
}

export default function JoinRoom() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  const cleanCode = useMemo(() => sanitizeCode(code), [code])
  const isValid = /^[A-Z0-9]{6}$/.test(cleanCode)

  if (!user) return <Navigate to="/welcome" replace />

  const submit = () => {
    if (!isValid) return
    navigate(`/room/${cleanCode}`)
  }

  return (
    <div className="page-shell content-container flex flex-col flex-1 min-h-0 bg-white">
      <SectionHeader title="Подключение к игре" backTo="/" />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-10 items-center text-center md:text-left">
        <div className="hidden md:flex flex-col items-start gap-3">
          <img src="/logo.png" alt="" className="w-32 h-32 object-contain" />
          <div className="text-[22px] leading-[28px] font-semibold text-[var(--qz-text)]">Подключайся с кодом</div>
          <div className="text-[17px] leading-[24px] text-[var(--qz-gray)]">
            Введи код комнаты, чтобы моментально войти в игру. Делись QR с друзьями — они подключатся за пару секунд.
          </div>
        </div>

        <div className="flex flex-col items-center md:items-start md:justify-center text-center md:text-left px-3 md:px-0">
          <img src="/logo.png" alt="" className="w-28 h-28 object-contain md:hidden mb-4" />

          <div className="text-[20px] leading-[24px] font-semibold text-[var(--qz-text)]">Введи код комнаты</div>
          <div className="mt-2 text-[17px] leading-[26px] font-normal text-[var(--qz-gray)]">
            Его можно узнать у участников игры
          </div>

          <div className="mt-6 w-full max-w-[320px]">
            <RoomCodeInput value={cleanCode} onChange={setCode} onEnter={submit} autoFocus blurOnComplete />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!isValid}
            className={[
              'mt-6 w-full max-w-[320px] h-[50px] rounded-[10px] font-semibold text-[17px] leading-[26px]',
              'text-white',
              'disabled:opacity-[0.35] disabled:cursor-not-allowed',
            ].join(' ')}
            style={{ backgroundColor: 'var(--qz-blue)' }}
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  )
}
