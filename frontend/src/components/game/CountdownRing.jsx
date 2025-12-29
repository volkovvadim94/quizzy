export default function CountdownRing({
  value = 0,
  max = 20,
  size = 46,
  strokeWidth = 3,
  color = 'var(--qz-blue)',
  trackColor = 'var(--qz-blue-10)',
} = {}) {
  const safeMax = Math.max(1, Number(max) || 1)
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0))
  const progress = safeValue / safeMax

  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const dashOffset = c * (1 - progress)

  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-white"
      style={{ width: size, height: size }}
      aria-label={`Осталось ${safeValue} секунд`}
      title={`Осталось ${safeValue} секунд`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1000ms linear' }}
          />
        </g>
      </svg>
      <div className="text-[17px] leading-none font-extrabold tabular-nums text-[var(--qz-blue)]">{safeValue}</div>
    </div>
  )
}
