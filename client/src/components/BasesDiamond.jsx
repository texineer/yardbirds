// Props:
//   runners: { first: bool, second: bool, third: bool }
//   interactive: bool — if true, bases are tappable
//   onToggle: (base: 'first'|'second'|'third') => void
//   size: number (default 140)
export default function BasesDiamond({ runners = {}, interactive = false, onToggle, size = 140 }) {
  const BASE_POSITIONS = {
    first:  { cx: 105, cy: 75,  label: '1B', labelX: 118, labelY: 82 },
    second: { cx: 70,  cy: 40,  label: '2B', labelX: 70,  labelY: 29 },
    third:  { cx: 35,  cy: 75,  label: '3B', labelX: 22,  labelY: 82 },
  }

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 140 140" width={size} height={size} overflow="visible" aria-label={
        `Bases: ${Object.entries(runners).filter(([,v]) => v).map(([k]) => ({ first:'1st', second:'2nd', third:'3rd' }[k])).join(', ') || 'none occupied'}`
      }>
        {/* Field circle */}
        <circle cx="70" cy="75" r="54"
          fill="rgba(138,175,198,0.08)"
          stroke="var(--border)" strokeWidth="1" />

        {/* Diamond outline */}
        <path d="M 70 110 L 105 75 L 70 40 L 35 75 Z"
          fill="rgba(43,62,80,0.04)"
          stroke="var(--powder)" strokeWidth="1.5" />

        {/* Home plate */}
        <polygon
          points="70,118 76,113 76,107 64,107 64,113"
          fill="var(--navy)" opacity="0.5" />
        <text x="70" y="126" fontSize="8" fontFamily="'DM Sans',sans-serif"
          fontWeight="700" fill="var(--navy-muted)" textAnchor="middle" opacity="0.6">H</text>

        {/* Bases */}
        {Object.entries(BASE_POSITIONS).map(([base, pos]) => {
          const occupied = !!runners[base]
          return (
            <g key={base}>
              {/* Glow ring when occupied */}
              {occupied && (
                <rect
                  x={pos.cx - 13} y={pos.cy - 13}
                  width="26" height="26" rx="4"
                  transform={`rotate(45 ${pos.cx} ${pos.cy})`}
                  fill="none"
                  stroke="var(--gold)" strokeWidth="1.5" opacity="0.4"
                />
              )}

              {/* Base square */}
              <rect
                x={pos.cx - 9} y={pos.cy - 9}
                width="18" height="18" rx="2"
                transform={`rotate(45 ${pos.cx} ${pos.cy})`}
                fill={occupied ? 'var(--gold)' : 'var(--cream)'}
                stroke={occupied ? 'var(--gold-dark, #b8891e)' : 'var(--powder)'}
                strokeWidth="2"
                style={{ transition: 'fill 0.15s, stroke 0.15s' }}
              />

              {/* Runner dot */}
              {occupied && (
                <circle cx={pos.cx} cy={pos.cy} r="4.5"
                  fill="var(--navy)" opacity="0.55" />
              )}

              {/* Label */}
              <text x={pos.labelX} y={pos.labelY}
                fontSize="9" fontFamily="'DM Sans',sans-serif"
                fontWeight="700" fill="var(--navy-muted)"
                textAnchor="middle" letterSpacing="0.05em">
                {pos.label}
              </text>

              {/* Tap target (interactive mode only) */}
              {interactive && (
                <rect
                  x={pos.cx - 24} y={pos.cy - 24}
                  width="48" height="48"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onToggle?.(base)}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
