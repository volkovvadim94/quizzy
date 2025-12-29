import { useEffect, useMemo, useRef } from 'react'

const ROOM_CODE_CHAR_RE = /^[A-Z0-9]$/

function sanitizeChars(text = '') {
  return String(text).replace(/[^0-9a-z]/gi, '').toUpperCase()
}

export default function RoomCodeInput({
  value = '',
  length = 6,
  autoFocus = false,
  disabled = false,
  blurOnComplete = false,
  onChange,
  onEnter,
} = {}) {
  const inputRefs = useRef([])
  const didAutoFocusRef = useRef(false)

  const chars = useMemo(() => {
    const safe = sanitizeChars(value).slice(0, length)
    return Array.from({ length }, (_, i) => safe[i] || '')
  }, [value, length])

  const isComplete = chars.every((c) => ROOM_CODE_CHAR_RE.test(c))

  const focusIndex = (index) => {
    const el = inputRefs.current[index]
    if (!el) return
    el.focus()
    try {
      el.select?.()
    } catch {
      // ignore
    }
  }

  const emit = (nextChars, { focusTo } = {}) => {
    const nextValue = nextChars.join('')
    onChange?.(nextChars.join(''))
    if (typeof focusTo === 'number') focusIndex(focusTo)
    if (
      blurOnComplete &&
      Array.from(nextValue).length === length &&
      nextChars.every((c) => ROOM_CODE_CHAR_RE.test(c))
    ) {
      try {
        document?.activeElement?.blur?.()
      } catch {
        // ignore
      }
    }
  }

  const setChar = (index, nextChar, { focusTo } = {}) => {
    const nextChars = chars.slice()
    nextChars[index] = nextChar
    emit(nextChars, { focusTo })
  }

  const handleChange = (index, e) => {
    if (disabled) return
    const sanitized = sanitizeChars(e.target.value)
    if (!sanitized) {
      setChar(index, '')
      return
    }

    if (sanitized.length === 1) {
      const nextChar = sanitized[0]
      if (!ROOM_CODE_CHAR_RE.test(nextChar)) return
      const focusTo = index < length - 1 ? index + 1 : undefined
      setChar(index, nextChar, { focusTo })
      return
    }

    // Multi-char input (e.g. mobile suggestions) — distribute across boxes.
    const nextChars = chars.slice()
    let writeIndex = index
    for (const ch of sanitized) {
      if (writeIndex >= length) break
      if (!ROOM_CODE_CHAR_RE.test(ch)) continue
      nextChars[writeIndex] = ch
      writeIndex += 1
    }
    emit(nextChars, { focusTo: writeIndex >= length ? undefined : writeIndex })
  }

  const handleKeyDown = (index, e) => {
    if (disabled) return

    if (e.key === 'Enter') {
      if (isComplete) onEnter?.(chars.join(''))
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusIndex(Math.max(0, index - 1))
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusIndex(Math.min(length - 1, index + 1))
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (chars[index]) {
        setChar(index, '')
        return
      }
      if (index > 0) {
        const prevIndex = index - 1
        const nextChars = chars.slice()
        nextChars[prevIndex] = ''
        emit(nextChars, { focusTo: prevIndex })
      }
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      setChar(index, '')
      return
    }
  }

  const handlePaste = (index, e) => {
    if (disabled) return
    const text = e.clipboardData?.getData?.('text') ?? ''
    const sanitized = sanitizeChars(text)
    if (!sanitized) return
    e.preventDefault()

    const nextChars = chars.slice()
    let writeIndex = index
    for (const ch of sanitized) {
      if (writeIndex >= length) break
      if (!ROOM_CODE_CHAR_RE.test(ch)) continue
      nextChars[writeIndex] = ch
      writeIndex += 1
    }

    emit(nextChars, { focusTo: writeIndex >= length ? undefined : writeIndex })
  }

  const handleContainerClick = () => {
    if (disabled) return
    const firstEmpty = chars.findIndex((c) => !c)
    focusIndex(firstEmpty === -1 ? length - 1 : firstEmpty)
  }

  useEffect(() => {
    if (!autoFocus) return
    if (disabled) return
    if (didAutoFocusRef.current) return
    didAutoFocusRef.current = true
    const firstEmpty = chars.findIndex((c) => !c)
    focusIndex(firstEmpty === -1 ? length - 1 : firstEmpty)
  }, [autoFocus, disabled, chars, length])

  return (
    <div className="flex items-center justify-center gap-[16px]" onClick={handleContainerClick} role="group" aria-label="Код комнаты">
      {chars.map((ch, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          value={ch}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          inputMode="text"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled}
          maxLength={1}
          className={[
            'w-10 h-11 rounded-xl border-2 text-center text-[24px] leading-[26px] font-semibold',
            'bg-base-100 text-base-content',
            'outline-none focus:border-primary',
            disabled ? 'opacity-60' : 'border-base-300',
          ].join(' ')}
          aria-label={`Символ ${index + 1}`}
        />
      ))}
    </div>
  )
}
