export default function LoginCardPreview({
  title = 'Войти',
  primaryText = '',
  secondaryText = 'Подсказка/вторичный текст',
  buttonText = 'Войти',
  disabled = false,
  showSecondaryText = true,
  showPrimaryText = false,
} = {}) {
  return (
    <div className="card w-full max-w-sm bg-base-200 shadow-xl">
      <div className="card-body space-y-4 text-center">
        <div className="text-xl font-bold">{title}</div>

        {showPrimaryText && primaryText ? <div className="text-sm opacity-80">{primaryText}</div> : null}
        {showSecondaryText && secondaryText ? <div className="text-xs opacity-60 leading-relaxed">{secondaryText}</div> : null}

        <button className={`btn btn-primary w-full gap-2 ${disabled ? 'btn-disabled' : ''}`} disabled={disabled}>
          {buttonText}
        </button>
      </div>
    </div>
  )
}

