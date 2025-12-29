import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { questionAPI } from '../utils/api'
import SectionHeader from '../components/layout/SectionHeader'
import LoadingScreen from '../components/feedback/LoadingScreen'

const palette = {
  black: 'var(--qz-black)',
  muted: 'var(--qz-gray)',
}

function pluralizeCollections(n) {
  const v = Math.abs(Number(n) || 0)
  const mod10 = v % 10
  const mod100 = v % 100
  if (mod10 === 1 && mod100 !== 11) return `${v} подборка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${v} подборки`
  return `${v} подборок`
}

function ThemeCard({ title, subtitle, imageSrc, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative w-full h-[240px] rounded-[20px] overflow-hidden bg-[var(--qz-black)] text-left shadow-[0_32px_64px_rgba(0,0,0,0.04),0_0_2px_rgba(0,0,0,0.02)]',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <img src={imageSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-[129px] bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="absolute left-5 right-5 bottom-5">
        <div className="text-white text-[17px] leading-[22px] font-semibold tracking-[-0.4px]">{title}</div>
        <div className="text-white/50 text-[15px] leading-[22px] font-normal">{subtitle}</div>
      </div>
    </button>
  )
}

export default function NewGameTheme() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imagesReady, setImagesReady] = useState(false)

  const slugifyTopic = (topic) =>
    (topic.slug ||
      String(topic.name || topic.id || 'default')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-'))

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        setImagesReady(false)
        const { data } = await questionAPI.getTopics()
        if (!active) return
        setTopics(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!active) return
        setError(e?.userMessage || e?.message || 'Не удалось загрузить темы')
      } finally {
        if (!active) return
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (loading || error) return
    if (!topics.length) {
      setImagesReady(true)
      return
    }

    let active = true
    setImagesReady(false)
    const controllers = []

    const preload = (src) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = img.onerror = () => resolve()
        img.src = src
        controllers.push(img)
      })

    Promise.all(topics.map((t) => preload(`/topics/${slugifyTopic(t)}.jpg`))).then(() => {
      if (active) setImagesReady(true)
    })

    return () => {
      active = false
      controllers.forEach((img) => {
        img.onload = null
        img.onerror = null
      })
    }
  }, [topics, loading, error])

  if (!user) return <Navigate to="/welcome" replace />

  const showLoader = loading || (!error && !imagesReady)

  return (
    <div className="page-shell content-container flex flex-col flex-1 min-h-0 bg-white">
      <SectionHeader title="Новая игра" subtitle="Тема" backTo="/" />

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto scroll-mask pb-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3">
            {showLoader ? (
              <LoadingScreen
                fullscreen={false}
                visible={showLoader}
                minDuration={600}
                message={loading ? 'Загружаем темы' : 'Готовим изображения'}
                subtext={loading ? 'Готовим коллекции вопросов' : 'Почти готово'}
                className="py-10"
              />
            ) : error ? (
              <div className="py-10 text-center text-red-600">{error}</div>
            ) : (
              topics.map((t) => {
                const slug = slugifyTopic(t)
                const imgUrl = `/topics/${slug}.jpg`
                const isLocked = Boolean(t.isLocked)
                const subtitle = isLocked ? 'Недоступно' : pluralizeCollections(t.collectionCount ?? 0)
                return (
                  <ThemeCard
                    key={t.id}
                    title={t.name || 'Тема'}
                    subtitle={subtitle}
                    imageSrc={imgUrl}
                    disabled={isLocked}
                    onClick={() => navigate(`/new-game/packs?topicId=${encodeURIComponent(String(t.id))}`)}
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
