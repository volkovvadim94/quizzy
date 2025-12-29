import React from 'react'

const Snackbar = ({ message, type = 'success', visible }) => {
  const bg = type === 'error' ? 'var(--qz-error)' : 'var(--qz-success)'
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-6 px-4 py-2 rounded-lg text-white text-sm shadow-lg z-50 transition-all duration-200 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
      style={{ background: bg }}
    >
      {message}
    </div>
  )
}

export default Snackbar
