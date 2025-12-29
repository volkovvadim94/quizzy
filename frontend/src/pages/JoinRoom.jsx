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
    <div className="-mx-4 -my-4 flex flex-col flex-1 min-h-0 bg-white">
      <SectionHeader title="Подключение к игре" backTo="/" />

      <div className="flex-1 flex flex-col items-center text-center px-3">
        <img src="/logo.png" alt="" className="w-32 h-32 mt-8 object-contain" />

        <div className="mt-6 text-[20px] leading-[24px] font-semibold text-[var(--qz-text)]">Введи код комнаты</div>
        <div className="mt-2 text-[17px] leading-[26px] font-normal text-[var(--qz-gray)]">Его можно узнать у участников игры</div>

        <div className="mt-6">
          <RoomCodeInput value={cleanCode} onChange={setCode} onEnter={submit} autoFocus blurOnComplete />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!isValid}
          className={[
            'mt-6 w-full h-[50px] rounded-[10px] font-semibold text-[17px] leading-[26px]',
            'text-white',
            'disabled:opacity-[0.35] disabled:cursor-not-allowed',
          ].join(' ')}
          style={{ backgroundColor: 'var(--qz-blue)' }}
        >
          Войти
        </button>
      </div>
    </div>
  )
}
