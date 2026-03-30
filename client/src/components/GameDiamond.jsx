// Interactive baseball diamond showing runners, batter, pitcher, and fielder positions
// Used as the primary visual element in the scorebook

export default function GameDiamond({
  runners = {},        // { first: 'Player Name' | null, second: ..., third: ... }
  batter = null,       // { player_name, jersey_number, position }
  pitcher = null,      // { player_name, jersey_number }
  onBaseClick,         // (base: 'first'|'second'|'third') => void
  interactive = false, // enable tapping bases
  size = 320,
}) {
  const vb = '0 0 200 220'

  function handleBaseClick(base) {
    if (interactive && onBaseClick) onBaseClick(base)
  }

  return (
    <svg viewBox={vb} width={size} height={size * 1.1} style={{ display: 'block', margin: '0 auto' }}>
      {/* Outfield grass arc */}
      <path d="M 100 200 L 5 95 A 135 135 0 0 1 195 95 Z" fill="#4a8c3f" stroke="#3a7030" strokeWidth="0.8" />

      {/* Infield dirt */}
      <path d="M 100 195 L 55 140 L 100 95 L 145 140 Z" fill="#c4915a" stroke="#a67840" strokeWidth="0.5" />

      {/* Infield grass */}
      <path d="M 100 185 L 62 145 L 100 108 L 138 145 Z" fill="#4a8c3f" stroke="#3a7030" strokeWidth="0.3" />

      {/* Foul lines */}
      <line x1="100" y1="200" x2="5" y2="95" stroke="white" strokeWidth="0.8" opacity="0.7" />
      <line x1="100" y1="200" x2="195" y2="95" stroke="white" strokeWidth="0.8" opacity="0.7" />

      {/* Base paths */}
      <line x1="100" y1="195" x2="145" y2="140" stroke="white" strokeWidth="0.5" opacity="0.5" />
      <line x1="145" y1="140" x2="100" y2="95" stroke="white" strokeWidth="0.5" opacity="0.5" />
      <line x1="100" y1="95" x2="55" y2="140" stroke="white" strokeWidth="0.5" opacity="0.5" />
      <line x1="55" y1="140" x2="100" y2="195" stroke="white" strokeWidth="0.5" opacity="0.5" />

      {/* Pitcher's mound */}
      <circle cx="100" cy="148" r="4" fill="#c4915a" stroke="#a67840" strokeWidth="0.5" />
      <rect x="98" y="147" width="4" height="1" fill="white" rx="0.5" />

      {/* Pitcher name */}
      {pitcher && (
        <text x="100" y="160" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" fontFamily="sans-serif"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          {pitcher.player_name?.split(' ').pop() || 'P'}
        </text>
      )}

      {/* Home plate */}
      <polygon points="100,198 96,194 96,191 104,191 104,194" fill="white" />

      {/* Batter at home */}
      {batter && (
        <>
          <rect x="65" y="196" width="70" height="16" rx="4" fill="rgba(43,62,80,0.85)" />
          <text x="100" y="207" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="sans-serif">
            {batter.jersey_number ? `#${batter.jersey_number} ` : ''}{batter.player_name || 'AT BAT'}
          </text>
        </>
      )}

      {/* ── BASES WITH RUNNERS ── */}

      {/* First Base */}
      <g onClick={() => handleBaseClick('first')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
        {runners.first && (
          <circle cx="145" cy="140" r="14" fill="rgba(212,168,50,0.25)" stroke="var(--gold, #d4a832)" strokeWidth="1" />
        )}
        <rect x="141" y="136" width="8" height="8" rx="1"
          fill={runners.first ? '#d4a832' : 'white'}
          stroke={runners.first ? '#b8891e' : '#ccc'}
          strokeWidth="0.8"
          transform="rotate(45 145 140)" />
        {runners.first && (
          <text x="145" y="128" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
            {shortName(runners.first)}
          </text>
        )}
        {interactive && <rect x="130" y="125" width="30" height="30" fill="transparent" />}
      </g>

      {/* Second Base */}
      <g onClick={() => handleBaseClick('second')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
        {runners.second && (
          <circle cx="100" cy="95" r="14" fill="rgba(212,168,50,0.25)" stroke="var(--gold, #d4a832)" strokeWidth="1" />
        )}
        <rect x="96" y="91" width="8" height="8" rx="1"
          fill={runners.second ? '#d4a832' : 'white'}
          stroke={runners.second ? '#b8891e' : '#ccc'}
          strokeWidth="0.8"
          transform="rotate(45 100 95)" />
        {runners.second && (
          <text x="100" y="83" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
            {shortName(runners.second)}
          </text>
        )}
        {interactive && <rect x="85" y="80" width="30" height="30" fill="transparent" />}
      </g>

      {/* Third Base */}
      <g onClick={() => handleBaseClick('third')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
        {runners.third && (
          <circle cx="55" cy="140" r="14" fill="rgba(212,168,50,0.25)" stroke="var(--gold, #d4a832)" strokeWidth="1" />
        )}
        <rect x="51" y="136" width="8" height="8" rx="1"
          fill={runners.third ? '#d4a832' : 'white'}
          stroke={runners.third ? '#b8891e' : '#ccc'}
          strokeWidth="0.8"
          transform="rotate(45 55 140)" />
        {runners.third && (
          <text x="55" y="128" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
            {shortName(runners.third)}
          </text>
        )}
        {interactive && <rect x="40" y="125" width="30" height="30" fill="transparent" />}
      </g>

      {/* ── FIELDER POSITION LABELS ── */}
      <FielderDot x={30} y={60} label="LF" />
      <FielderDot x={100} y={38} label="CF" />
      <FielderDot x={170} y={60} label="RF" />
      <FielderDot x={75} y={115} label="SS" />
      <FielderDot x={125} y={115} label="2B" />
      <FielderDot x={145} y={145} label="1B" />
      <FielderDot x={55} y={145} label="3B" />
      <FielderDot x={100} y={180} label="C" />

      {/* Outs indicator — small dots near bottom */}
    </svg>
  )
}

function FielderDot({ x, y, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill="rgba(43,62,80,0.5)" />
      <text x={x} y={y + 2.5} textAnchor="middle" fill="white"
        fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
        {label}
      </text>
    </g>
  )
}

function shortName(name) {
  if (!name || name === 'Runner' || name === 'Batter') return name
  const parts = name.split(' ')
  if (parts.length === 1) return name
  return `${parts[0][0]}. ${parts[parts.length - 1]}`
}
