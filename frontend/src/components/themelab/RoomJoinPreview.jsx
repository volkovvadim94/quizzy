export default function RoomJoinPreview({
  value = '',
  onChange,
  placeholder = 'Введи код комнаты',
  buttonText = 'Войти',
  disabled = false,
} = {}) {
  return (
    <div className="w-full max-w-sm">
      <div className="w-full h-12 flex items-center rounded-xl overflow-hidden room-join">
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 h-12 px-4 room-join-input bg-transparent border-0 focus:outline-none focus:ring-0 rounded-l-xl"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
        />
        <button
          className="room-join-btn h-12 w-[96px] px-2 font-semibold flex items-center justify-center text-sm sm:text-base leading-none text-center"
          type="button"
          disabled={disabled}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

