import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function formatNumber(value) {
  const n = Number(value || 0)
  return new Intl.NumberFormat('ru-RU').format(Number.isFinite(n) ? n : 0)
}

function getDisplayName(user) {
  if (!user) return ''
  if (user.username) return user.username
  const first = user.firstName || ''
  const last = user.lastName || ''
  const full = `${first} ${last}`.trim()
  return full || 'Игрок'
}

function getGamerTier() {
  return 'Геймер V'
}

const palette = {
  primary: 'var(--qz-blue)',
  text: 'var(--qz-text)',
  muted: 'var(--qz-gray)',
  border: 'var(--qz-black-5)',
  black: 'var(--qz-black)',
  yellow: 'var(--qz-yellow)',
}

function ActionCard({ title, subtitle, imageSrc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-[300px] rounded-[20px] overflow-hidden bg-[var(--qz-black)] shadow-[0_32px_64px_rgba(0,0,0,0.04),0_0_2px_rgba(0,0,0,0.02)] text-left"
    >
      <img src={imageSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <img src="/_mock/home-body.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="absolute inset-x-0 bottom-0 h-[129px] bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="absolute left-5 right-5 bottom-5">
        <div className="text-white text-[17px] leading-[22px] font-semibold tracking-[-0.4px]">{title}</div>
        <div className="text-white/60 text-[15px] leading-[22px] font-normal">{subtitle}</div>
      </div>
    </button>
  )
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const displayName = useMemo(() => getDisplayName(user), [user])
  const totalScore = user?.totalScore ?? 0
  const gems = 0
  const tier = useMemo(() => getGamerTier(totalScore), [totalScore])
  const avatarUrl = user?.avatarUrl || '/_mock/avatar.png'

  if (!user) return <Navigate to="/welcome" replace />

  return (
    <div className="w-full max-w-[430px] mx-auto pb-20">
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover bg-[var(--qz-black-5)]" />

          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold text-[var(--qz-text)] truncate">{displayName}</div>
            <div className="text-[12px] font-bold leading-[19px] text-[var(--qz-text)]">
              <span className="mr-1">🏆</span>
              <span className="text-[var(--qz-yellow)]">{formatNumber(totalScore)}</span>
              <span className="mx-1 text-[var(--qz-text)]">/</span>
              <span className="text-[var(--qz-blue)]">{tier}</span>
            </div>
          </div>

          <div className="shrink-0 flex items-center rounded-full border bg-white h-8 pl-2 pr-1 gap-2" style={{ borderColor: palette.primary }}>
            <div className="text-[16px] leading-none">💎</div>
            <div className="text-[20px] font-black text-[var(--qz-text)] leading-none">{formatNumber(gems)}</div>
            <button
              type="button"
              className="w-6 h-6 rounded-full text-white flex items-center justify-center leading-none font-semibold"
              style={{ backgroundColor: palette.primary }}
              aria-label="Пополнить"
              title="Пополнить"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <ActionCard
          title="Подключиться к игре"
          subtitle="Ввести код комнаты"
          imageSrc="/topics/games.jpg"
          onClick={() => navigate('/join')}
        />

        <ActionCard
          title="Создать игру"
          subtitle="Выбрать тему и пригласить игроков"
          imageSrc="/topics/general.jpg"
          onClick={() => navigate('/new-game/theme')}
        />
      </div>
    </div>
  )
}
