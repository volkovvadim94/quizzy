import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authAPI } from '../utils/api'
import { Crown, LogOut, Trophy, X } from 'lucide-react'

const Profile = () => {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)

  const isWebApp = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData)

  const displayName = useMemo(() => {
    if (profile?.player?.username) return profile.player.username
    if (user?.username) return user.username
    const first = profile?.player?.firstName || user?.firstName || ''
    const last = profile?.player?.lastName || user?.lastName || ''
    const full = `${first} ${last}`.trim()
    return full || 'Игрок'
  }, [profile, user])

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/', { replace: true })
      return
    }

    const fetchProfile = async () => {
      try {
        setLoadingProfile(true)
        setError('')
        const { data } = await authAPI.getProfile()
        setProfile(data)
      } catch (e) {
        setError(e?.userMessage || e?.response?.data?.error || e?.message || 'Не удалось получить профиль')
      } finally {
        setLoadingProfile(false)
      }
    }

    fetchProfile()
  }, [user, loading, navigate])

  const handleClose = () => {
    if (window.Telegram?.WebApp?.close) {
      window.Telegram.WebApp.close()
    } else {
      navigate('/')
    }
  }

  const avatarUrl = profile?.player?.avatarUrl || user?.avatarUrl || ''
  const score = profile?.player?.totalScore ?? user?.totalScore ?? 0
  const rank = profile?.rank ?? null
  const totalPlayers = profile?.totalPlayers ?? null

  return (
    <div className="flex flex-col gap-4 flex-1 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6" />
          Профиль
        </h1>
        <div className="flex gap-2">
          {isWebApp ? null : (
            <button onClick={logout} className="btn btn-ghost gap-2 text-error border-0">
              <LogOut size={18} />
              Выйти
            </button>
          )}
          <button onClick={handleClose} className="btn btn-primary gap-2">
            <X size={18} />
            Закрыть
          </button>
        </div>
      </div>

      <div className="card glass-card border border-base-300/60">
        <div className="card-body flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="avatar">
            <div className="w-24 h-24 rounded-2xl ring ring-primary ring-offset-base-200 ring-offset-2 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-base-300 flex items-center justify-center text-3xl font-bold">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="text-2xl font-semibold">{displayName}</div>
            <div className="text-sm opacity-70">Telegram ID: {profile?.player?.telegramId || '—'}</div>
            <div className="flex flex-wrap gap-3 mt-2">
              <Badge icon={<Trophy size={16} />} label="Суммарный рейтинг" value={score} />
              {rank && totalPlayers ? (
                <Badge icon={<Crown size={16} />} label="Глобальное место" value={`#${rank} из ${totalPlayers}`} />
              ) : null}
            </div>
            {error ? <div className="text-error text-sm">{error}</div> : null}
            {loadingProfile ? (
              <div className="text-sm opacity-80">Загружаем профиль...</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card glass-card border border-base-300/60">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-3">
            <Crown size={18} className="text-primary" />
            <h2 className="text-xl font-semibold">Топ игроков</h2>
          </div>
          {loadingProfile ? (
            <div className="flex items-center gap-2 text-sm opacity-80">
              <span className="loading loading-spinner loading-sm"></span>
              Загружаем рейтинг...
            </div>
          ) : profile?.topPlayers?.length ? (
            <ul className="divide-y divide-base-300/70">
              {profile.topPlayers.map((p, idx) => (
                <li key={p.id} className="py-3 flex items-center gap-3">
                  <div className="w-8 text-center text-sm font-semibold text-primary">#{idx + 1}</div>
                  <div className="avatar">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-base-200">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.username || p.firstName || 'player'} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-semibold">
                          {(p.username || p.firstName || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{p.username || p.firstName || 'Игрок'}</div>
                    <div className="text-xs opacity-70">{p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : '—'}</div>
                  </div>
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <Trophy size={16} className="text-primary" />
                    {p.totalScore}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm opacity-70">Пока нет данных по рейтингу.</div>
          )}
        </div>
      </div>
    </div>
  )
}

const Badge = ({ icon, label, value }) => (
  <div className="px-3 py-2 rounded-xl bg-base-200 flex items-center gap-2 text-sm">
    <span className="text-primary">{icon}</span>
    <div className="flex flex-col leading-none">
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  </div>
)

export default Profile
