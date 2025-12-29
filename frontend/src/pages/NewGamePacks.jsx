import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { gameAPI, questionAPI } from '../utils/api'
import SectionHeader from '../components/layout/SectionHeader'
import LoadingScreen from '../components/feedback/LoadingScreen'

const palette = {
  text: 'var(--qz-text)',
  muted: 'var(--qz-gray)',
  black: 'var(--qz-black)',
}

function pluralizeQuestions(n) {
  const v = Math.abs(Number(n) || 0)
  const mod10 = v % 10
  const mod100 = v % 100
  if (mod10 === 1 && mod100 !== 11) return `${v} вопрос`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${v} вопроса`
  return `${v} вопросов`
}

function PriceBadge({ label }) {
  return (
    <div className="absolute right-4 top-4 bg-white/90 rounded-full px-3 h-8 flex items-center shadow-sm">
      <div className="text-[16px] leading-none font-bold text-[var(--qz-text)]">{label}</div>
    </div>
  )
}

function PackCard({ title, subtitle, imageSrc, badge, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative w-full h-[240px] rounded-[20px] overflow-hidden bg-[var(--qz-black)] text-left',
        'shadow-[0_32px_64px_rgba(0,0,0,0.04),0_0_2px_rgba(0,0,0,0.02)]',
        disabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      <img src={imageSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />

      {badge ? <PriceBadge label={badge} /> : null}

      <div className="absolute left-4 right-4 bottom-4">
        <div className="text-white text-[18px] leading-[22px] font-extrabold">{title}</div>
        <div className="text-white/70 text-[15px] leading-[22px] font-normal">{subtitle}</div>
      </div>
    </button>
  )
}

export default function NewGamePacks() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const topicId = params.get('topicId') || ''

  const [topic, setTopic] = useState(null)
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingId, setCreatingId] = useState(null)

  const topicImageSrc = useMemo(() => {
    const slug = topic?.slug || 'default'
    return `/topics/${slug}.jpg`
  }, [topic?.slug])

  useEffect(() => {
    if (!topicId) return
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const { data } = await questionAPI.getTopicCollections(topicId)
        if (!active) return
        setTopic(data?.topic || null)
        setCollections(Array.isArray(data?.collections) ? data.collections : [])
      } catch (e) {
        if (!active) return
        setError(e?.userMessage || e?.message || 'Не удалось загрузить подборки')
      } finally {
        if (!active) return
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [topicId])

  if (!user) return <Navigate to="/welcome" replace />
  if (!topicId) return <Navigate to="/new-game/theme" replace />

  const handlePick = async (collection) => {
    if (!collection || collection.isLocked) return
    if (creatingId) return
    setCreatingId(collection.id)
    try {
      const { data } = await gameAPI.create({ topicId: topic?.id || topicId, collectionIds: [collection.id] })
      const gameId = data?.id
      if (gameId) navigate(`/room/${gameId}`)
    } catch (e) {
      setError(e?.userMessage || e?.message || 'Не удалось создать игру')
    } finally {
      setCreatingId(null)
    }
  }

  return (
    <div className="page-shell content-container flex flex-col flex-1 min-h-0 bg-white">
      <SectionHeader title={topic?.name || 'Тема'} subtitle="Подборка" backTo="/new-game/theme" />

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto scroll-mask pb-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3">
            {loading ? (
              <LoadingScreen
                fullscreen={false}
                visible={loading}
                minDuration={600}
                message="Загружаем подборки"
                subtext="Подготавливаем варианты тем"
                className="py-10"
              />
            ) : error ? (
              <div className="py-6 text-center text-red-600">{error}</div>
            ) : collections.length === 0 ? (
              <div className="py-10 text-center text-[var(--qz-gray)]">Подборок пока нет</div>
            ) : (
              collections.map((c) => {
                const badge = c.isLocked ? (c.priceGems ? `💎 ${c.priceGems}` : 'Недоступно') : c.isFree ? 'Бесплатно' : c.priceGems ? `💎 ${c.priceGems}` : null
                const disabled = Boolean(c.isLocked) || creatingId === c.id
                const subtitle = pluralizeQuestions(c.questionCount ?? 0)
                return (
                  <PackCard
                    key={c.id}
                    title={c.name}
                    subtitle={subtitle}
                    imageSrc={topicImageSrc}
                    badge={badge}
                    disabled={disabled}
                    onClick={() => handlePick(c)}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
