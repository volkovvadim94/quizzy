import React from 'react'

const palette = {
  primary: 'var(--quizzy-primary)',
  secondary: 'var(--quizzy-secondary)',
  optionBg: 'var(--quizzy-option-bg)',
  optionText: 'var(--quizzy-option-text)',
  white: 'var(--qz-white)',
  success: 'var(--quizzy-success)',
  danger: 'var(--quizzy-danger)',
  border: 'var(--qz-black-5)',
}

export default function AnswerOption({
  text,
  letter,
  showLetter = true,
  isSelected = false,
  isCorrect = false,
  isWrong = false,
  isRevealPhase = false,
  hasSubmitted = false,
  isSequence = false,
  sequenceNumber = null,
  onSelect,
}) {
  const showPrimaryBg = hasSubmitted && isSelected && !isWrong && !isRevealPhase

  const baseBg = palette.optionBg
  const baseText = palette.optionText
  const correctBg = palette.success
  const wrongBg = palette.danger
  const selectedBg = showPrimaryBg ? palette.primary : baseBg
  const selectedText = showPrimaryBg ? 'var(--quizzy-btn-primary-fg)' : baseText

  let background = selectedBg
  let color = selectedText
  let borderColor = 'transparent'

  if (isRevealPhase) {
    if (isCorrect) {
      background = correctBg
      color = palette.white
    } else if (isWrong) {
      background = wrongBg
      color = palette.white
    } else if (isSelected) {
      background = palette.primary
      color = 'var(--quizzy-btn-primary-fg)'
    }
  } else if (isSelected) {
    borderColor = palette.primary
  } else {
    borderColor = palette.border
  }

  return (
    <div
      className="answer-option relative w-full text-left px-4 py-3 rounded-2xl border"
      style={{
        background,
        color,
        borderColor: borderColor !== 'transparent' ? borderColor : 'transparent',
        '--answer-correct-bg': correctBg,
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.()
      }}
    >
      <div className="flex items-center gap-3">
        {showLetter ? (
          <span className="font-semibold">{letter}</span>
        ) : null}
        <span className="break-words flex-1">{text}</span>
        {isSequence && sequenceNumber !== null ? (
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold tabular-nums"
            style={{
              background: hasSubmitted && !isRevealPhase ? palette.secondary : palette.optionBg,
              color: hasSubmitted && !isRevealPhase ? 'var(--quizzy-btn-secondary-fg)' : color,
              border: `2px solid ${
                hasSubmitted && !isRevealPhase
                  ? palette.secondary
                  : isSelected && !isRevealPhase
                    ? palette.primary
                    : 'rgba(255,255,255,0.25)'
              }`,
            }}
          >
            {sequenceNumber}
          </span>
        ) : null}
      </div>
    </div>
  )
}
