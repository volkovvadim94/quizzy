const DEFAULT_TOPIC_IMG = '/topics/default.jpg'

export default function TopicCard({
  title = 'Тема',
  imageUrl = '',
  useDefaultImage = true,
  showOverlay = true,
  onClick,
} = {}) {
  const img = imageUrl || (useDefaultImage ? DEFAULT_TOPIC_IMG : '')
  const clickable = typeof onClick === 'function'

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      className="topic-card relative rounded-2xl overflow-hidden select-none h-[200px] sm:h-[300px]"
      style={{
        backgroundColor: 'var(--quizzy-topic-card-bg)',
        borderRadius: 'var(--quizzy-topic-card-radius)',
      }}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.()
            }
          : undefined
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 pointer-pass">
        {img ? (
          <img
            src={img}
            alt={title}
            loading="lazy"
            decoding="async"
            width="640"
            height="360"
            draggable={false}
            className="w-full h-full object-cover"
            onError={(e) => {
              if (e.currentTarget.src.endsWith(DEFAULT_TOPIC_IMG)) return
              e.currentTarget.src = DEFAULT_TOPIC_IMG
            }}
          />
        ) : null}
        {showOverlay ? (
          <div
            className="absolute inset-0 pointer-pass"
            style={{
              background: `linear-gradient(180deg,
                rgb(var(--quizzy-topic-card-overlay-rgb) / var(--quizzy-topic-card-overlay-alpha-top)),
                rgb(var(--quizzy-topic-card-overlay-rgb) / var(--quizzy-topic-card-overlay-alpha-bottom))
              )`,
            }}
          />
        ) : null}
      </div>

      <div className="absolute inset-0 flex items-end px-4 py-4 pointer-pass">
        <div className="flex items-end justify-between w-full gap-3">
          <span className="font-bold text-2xl drop-shadow" style={{ color: 'var(--quizzy-topic-card-title)' }}>
            {title}
          </span>
        </div>
      </div>
    </div>
  )
}

