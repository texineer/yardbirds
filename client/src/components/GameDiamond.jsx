import { useState, useRef } from 'react'

// Interactive baseball diamond showing runners, batter, pitcher, and fielder positions
// Supports drag-to-place ball for hit location tracking

export default function GameDiamond({
  runners = {},        // { first: 'Player Name' | null, second: ..., third: ... }
  batter = null,       // { player_name, jersey_number, position }
  pitcher = null,      // { player_name, jersey_number }
  onBaseClick,         // (base: 'first'|'second'|'third') => void
  interactive = false, // enable tapping bases
  dragMode = false,    // enable draggable ball for hit location
  onBallDrop,          // (x, y) => void — called when ball is dropped (0-100 coords)
  hitMark = null,      // { x, y } — show where ball landed
  size = 320,
}) {
  const svgRef = useRef(null)
  const [ballPos, setBallPos] = useState(null) // { x, y } in SVG coords during drag
  const [dragging, setDragging] = useState(false)

  const VB_W = 200, VB_H = 220
  const HOME_X = 100, HOME_Y = 188 // ball start position (near home plate)

  function svgCoords(clientX, clientY) {
    const svg = svgRef.current
    if (!svg) return { x: HOME_X, y: HOME_Y }
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * VB_W
    const y = ((clientY - rect.top) / rect.height) * VB_H
    return { x, y }
  }

  function toNormalized(svgX, svgY) {
    // Convert SVG viewbox coords to 0-100 normalized
    return {
      x: Math.round((svgX / VB_W) * 1000) / 10,
      y: Math.round((svgY / VB_H) * 1000) / 10,
    }
  }

  function fromNormalized(nx, ny) {
    return { x: (nx / 100) * VB_W, y: (ny / 100) * VB_H }
  }

  // Touch handlers
  function handleTouchStart(e) {
    if (!dragMode) return
    e.preventDefault()
    setDragging(true)
    const touch = e.touches[0]
    setBallPos(svgCoords(touch.clientX, touch.clientY))
  }

  function handleTouchMove(e) {
    if (!dragging) return
    e.preventDefault()
    const touch = e.touches[0]
    setBallPos(svgCoords(touch.clientX, touch.clientY))
  }

  function handleTouchEnd() {
    if (!dragging) return
    setDragging(false)
    if (ballPos && onBallDrop) {
      const norm = toNormalized(ballPos.x, ballPos.y)
      onBallDrop(norm.x, norm.y)
    }
    setBallPos(null)
  }

  // Mouse handlers
  function handleMouseDown(e) {
    if (!dragMode) return
    e.preventDefault()
    setDragging(true)
    setBallPos(svgCoords(e.clientX, e.clientY))
  }

  function handleMouseMove(e) {
    if (!dragging) return
    setBallPos(svgCoords(e.clientX, e.clientY))
  }

  function handleMouseUp() {
    if (!dragging) return
    setDragging(false)
    if (ballPos && onBallDrop) {
      const norm = toNormalized(ballPos.x, ballPos.y)
      onBallDrop(norm.x, norm.y)
    }
    setBallPos(null)
  }

  function handleBaseClick(base) {
    if (interactive && onBaseClick) onBaseClick(base)
  }

  // Hit mark in SVG coords
  const hitMarkSvg = hitMark ? fromNormalized(hitMark.x, hitMark.y) : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={size}
      height={size * (VB_H / VB_W)}
      style={{ display: 'block', margin: '0 auto', touchAction: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
      {batter && !dragMode && (
        <>
          <rect x="65" y="196" width="70" height="16" rx="4" fill="rgba(43,62,80,0.85)" />
          <text x="100" y="207" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="sans-serif">
            {batter.jersey_number ? `#${batter.jersey_number} ` : ''}{batter.player_name || 'AT BAT'}
          </text>
        </>
      )}

      {/* ── BASES WITH RUNNERS ── */}
      <BaseWithRunner x={145} y={140} name={runners.first} base="first" onClick={handleBaseClick} interactive={interactive} />
      <BaseWithRunner x={100} y={95} name={runners.second} base="second" onClick={handleBaseClick} interactive={interactive} />
      <BaseWithRunner x={55} y={140} name={runners.third} base="third" onClick={handleBaseClick} interactive={interactive} />

      {/* ── FIELDER POSITION LABELS ── */}
      <FielderDot x={30} y={60} label="LF" />
      <FielderDot x={100} y={38} label="CF" />
      <FielderDot x={170} y={60} label="RF" />
      <FielderDot x={75} y={115} label="SS" />
      <FielderDot x={125} y={115} label="2B" />
      <FielderDot x={145} y={145} label="1B" />
      <FielderDot x={55} y={145} label="3B" />
      <FielderDot x={100} y={180} label="C" />

      {/* ── HIT MARK (where ball landed) ── */}
      {hitMarkSvg && !dragging && (
        <g>
          <circle cx={hitMarkSvg.x} cy={hitMarkSvg.y} r="6" fill="#e74c3c" opacity="0.85" />
          <circle cx={hitMarkSvg.x} cy={hitMarkSvg.y} r="9" fill="none" stroke="#e74c3c" strokeWidth="1" opacity="0.4" />
          <text x={hitMarkSvg.x} y={hitMarkSvg.y + 2} textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">⚾</text>
        </g>
      )}

      {/* ── DRAG MODE: Baseball at home plate or being dragged ── */}
      {dragMode && (
        <>
          {/* Instruction text */}
          {!dragging && !hitMark && (
            <text x="100" y="215" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" fontFamily="sans-serif" opacity="0.8">
              DRAG ⚾ TO WHERE BALL WAS HIT
            </text>
          )}

          {/* Draggable ball — start at home or follow finger */}
          <g
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{ cursor: 'grab' }}
          >
            <circle
              cx={dragging && ballPos ? ballPos.x : HOME_X}
              cy={dragging && ballPos ? ballPos.y : HOME_Y}
              r={dragging ? 10 : 8}
              fill={dragging ? '#e74c3c' : '#d4a832'}
              stroke={dragging ? '#c0392b' : '#b8891e'}
              strokeWidth="1.5"
              opacity={dragging ? 0.9 : 1}
            />
            <text
              x={dragging && ballPos ? ballPos.x : HOME_X}
              y={(dragging && ballPos ? ballPos.y : HOME_Y) + 2.5}
              textAnchor="middle" fill="white" fontSize="7" fontWeight="bold"
              style={{ pointerEvents: 'none' }}>
              ⚾
            </text>
            {/* Invisible larger touch target */}
            {!dragging && (
              <circle cx={HOME_X} cy={HOME_Y} r="20" fill="transparent" />
            )}
          </g>

          {/* Trail line from home to ball position */}
          {dragging && ballPos && (
            <line x1={HOME_X} y1={HOME_Y} x2={ballPos.x} y2={ballPos.y}
              stroke="rgba(231,76,60,0.4)" strokeWidth="1.5" strokeDasharray="4,3" />
          )}
        </>
      )}
    </svg>
  )
}

function BaseWithRunner({ x, y, name, base, onClick, interactive }) {
  const occupied = !!name
  return (
    <g onClick={() => onClick(base)} style={{ cursor: interactive ? 'pointer' : 'default' }}>
      {occupied && (
        <circle cx={x} cy={y} r="14" fill="rgba(212,168,50,0.25)" stroke="#d4a832" strokeWidth="1" />
      )}
      <rect x={x - 4} y={y - 4} width="8" height="8" rx="1"
        fill={occupied ? '#d4a832' : 'white'}
        stroke={occupied ? '#b8891e' : '#ccc'}
        strokeWidth="0.8"
        transform={`rotate(45 ${x} ${y})`} />
      {occupied && (
        <text x={x} y={y - 12} textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
          {shortName(name)}
        </text>
      )}
      {interactive && <rect x={x - 15} y={y - 15} width="30" height="30" fill="transparent" />}
    </g>
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
