import { useRef, useState } from 'react'

// Baseball field SVG with tap-to-mark hit location
// Coordinate system: (0,0) top-left, (100,100) bottom-right
// Home plate at bottom center (~50, 90), outfield at top

const POSITIONS = [
  { key: 'P',  x: 50, y: 62, label: 'P' },
  { key: 'C',  x: 50, y: 88, label: 'C' },
  { key: '1B', x: 68, y: 68, label: '1B' },
  { key: '2B', x: 58, y: 55, label: '2B' },
  { key: 'SS', x: 42, y: 55, label: 'SS' },
  { key: '3B', x: 32, y: 68, label: '3B' },
  { key: 'LF', x: 22, y: 32, label: 'LF' },
  { key: 'CF', x: 50, y: 18, label: 'CF' },
  { key: 'RF', x: 78, y: 32, label: 'RF' },
]

export default function FieldDiagram({ onTap, hitMark, size = 280, showPositions = true }) {
  const svgRef = useRef(null)
  const [tapping, setTapping] = useState(false)

  function handleClick(e) {
    if (!onTap) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onTap(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
  }

  function handleTouch(e) {
    if (!onTap) return
    e.preventDefault()
    const touch = e.touches[0]
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const x = ((touch.clientX - rect.left) / rect.width) * 100
    const y = ((touch.clientY - rect.top) / rect.height) * 100
    onTap(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      onClick={handleClick}
      onTouchStart={handleTouch}
      style={{ cursor: onTap ? 'crosshair' : 'default', touchAction: 'none' }}
    >
      {/* Outfield grass */}
      <path
        d="M 50 90 L 2 38 A 68 68 0 0 1 98 38 Z"
        fill="#4a8c3f"
        stroke="#3a7030"
        strokeWidth="0.5"
      />

      {/* Infield dirt */}
      <path
        d="M 50 90 L 30 65 L 50 48 L 70 65 Z"
        fill="#c4915a"
        stroke="#a67840"
        strokeWidth="0.5"
      />

      {/* Infield grass (inside diamond) */}
      <path
        d="M 50 85 L 35 68 L 50 54 L 65 68 Z"
        fill="#4a8c3f"
        stroke="#3a7030"
        strokeWidth="0.3"
      />

      {/* Pitcher's mound */}
      <circle cx="50" cy="65" r="2" fill="#c4915a" stroke="#a67840" strokeWidth="0.3" />

      {/* Base paths */}
      <line x1="50" y1="90" x2="70" y2="65" stroke="white" strokeWidth="0.4" opacity="0.6" />
      <line x1="70" y1="65" x2="50" y2="48" stroke="white" strokeWidth="0.4" opacity="0.6" />
      <line x1="50" y1="48" x2="30" y2="65" stroke="white" strokeWidth="0.4" opacity="0.6" />
      <line x1="30" y1="65" x2="50" y2="90" stroke="white" strokeWidth="0.4" opacity="0.6" />

      {/* Foul lines */}
      <line x1="50" y1="90" x2="2" y2="38" stroke="white" strokeWidth="0.5" opacity="0.7" />
      <line x1="50" y1="90" x2="98" y2="38" stroke="white" strokeWidth="0.5" opacity="0.7" />

      {/* Bases */}
      <rect x="48.5" y="88.5" width="3" height="3" fill="white" transform="rotate(45 50 90)" /> {/* Home */}
      <rect x="69" y="64" width="2.5" height="2.5" fill="white" transform="rotate(45 70.25 65.25)" /> {/* 1st */}
      <rect x="49" y="47" width="2.5" height="2.5" fill="white" transform="rotate(45 50.25 48.25)" /> {/* 2nd */}
      <rect x="29" y="64" width="2.5" height="2.5" fill="white" transform="rotate(45 30.25 65.25)" /> {/* 3rd */}

      {/* Position labels */}
      {showPositions && POSITIONS.map(p => (
        <g key={p.key}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="rgba(43,62,80,0.7)" />
          <text x={p.x} y={p.y + 1.2} textAnchor="middle" fill="white"
            fontSize="3" fontWeight="bold" fontFamily="sans-serif">
            {p.label}
          </text>
        </g>
      ))}

      {/* Hit mark */}
      {hitMark && (
        <g>
          <circle cx={hitMark.x} cy={hitMark.y} r="3" fill="var(--loss, #e74c3c)" opacity="0.9" />
          <circle cx={hitMark.x} cy={hitMark.y} r="5" fill="none" stroke="var(--loss, #e74c3c)" strokeWidth="0.5" opacity="0.5" />
          <line x1={hitMark.x - 2} y1={hitMark.y} x2={hitMark.x + 2} y2={hitMark.y} stroke="white" strokeWidth="0.5" />
          <line x1={hitMark.x} y1={hitMark.y - 2} x2={hitMark.x} y2={hitMark.y + 2} stroke="white" strokeWidth="0.5" />
        </g>
      )}
    </svg>
  )
}

export { POSITIONS }
