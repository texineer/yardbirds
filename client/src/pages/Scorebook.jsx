import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getScorebookState, updateScorebookState,
  logPitch, undoLastPitch, startPlateAppearance, recordPlateAppearanceOutcome,
  updateInningScore, endScorebookGame, recordSubstitution,
} from '../api'
import { useAuth } from '../context/AuthContext'
import FieldDiagram from '../components/FieldDiagram'
import BasesDiamond from '../components/BasesDiamond'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Constants ─────────────────────────────────────────────────────────────────

const ORDINALS = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH', '11TH', '12TH']

const HIT_TYPES = [
  { code: 'GB', label: 'GROUND BALL', icon: '⬇' },
  { code: 'LD', label: 'LINE DRIVE', icon: '➡' },
  { code: 'FB', label: 'FLY BALL', icon: '⬆' },
  { code: 'PU', label: 'POPUP', icon: '⤴' },
]

const FIELDER_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const RESULT_OPTIONS = {
  out: [
    { code: 'GO', label: 'Ground Out' },
    { code: 'FO', label: 'Fly Out' },
    { code: 'LO', label: 'Line Out' },
    { code: 'DP', label: 'Double Play' },
    { code: 'SAC', label: 'Sacrifice' },
    { code: 'FC', label: "Fielder's Choice" },
  ],
  hit: [
    { code: '1B', label: 'Single' },
    { code: '2B', label: 'Double' },
    { code: '3B', label: 'Triple' },
    { code: 'HR', label: 'Home Run' },
  ],
  error: [
    { code: 'E', label: 'Error' },
  ],
}

const RESULT_STYLES = {
  GO:  { bg: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' },
  FO:  { bg: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' },
  LO:  { bg: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' },
  DP:  { bg: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' },
  SAC: { bg: 'var(--sky)', color: 'var(--navy)' },
  FC:  { bg: 'var(--sky)', color: 'var(--navy)' },
  '1B': { bg: 'rgba(138,175,198,0.2)', color: 'var(--navy)' },
  '2B': { bg: 'rgba(138,175,198,0.3)', color: 'var(--navy)' },
  '3B': { bg: 'rgba(138,175,198,0.4)', color: 'var(--navy)' },
  HR:  { bg: 'var(--gold)', color: 'var(--navy)' },
  E:   { bg: 'var(--win-bg, #eaf5ee)', color: 'var(--win)' },
}

const PITCH_CHIP_STYLES = {
  B: { background: 'var(--win-bg, #eaf5ee)', color: 'var(--win)', label: 'B' },
  C: { background: 'var(--loss-bg, #fdecea)', color: 'var(--loss)', label: 'C' },
  F: { background: 'rgba(212,168,50,0.15)', color: 'var(--gold-dark, #b8891e)', label: 'F' },
  S: { background: 'rgba(184,106,42,0.15)', color: '#B86A2A', label: 'S' },
  X: { background: 'var(--win-bg, #eaf5ee)', color: 'var(--win)', label: 'X' },
}

// Scoring phase state machine
const PHASE = {
  PITCH: 'pitch',
  HIT_TYPE: 'hit_type',
  FIELD_TAP: 'field_tap',
  FIELDER: 'fielder',
  RESULT: 'result',
  RUNNERS: 'runners',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOutcome(code) {
  return ['GO', 'FO', 'LO', 'DP', 'SAC', 'FC', 'K', 'Kl'].includes(code)
}

function isHit(code) {
  return ['1B', '2B', '3B', 'HR'].includes(code)
}

function autoAdvanceRunners(runners, outcome) {
  let { first, second, third } = runners
  let runsScored = 0

  if (outcome === 'HR') {
    runsScored = (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0) + 1
    return { first: null, second: null, third: null, runsScored }
  }
  if (outcome === '3B') {
    runsScored = (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0)
    return { first: null, second: null, third: 'Batter', runsScored }
  }
  if (outcome === '2B') {
    runsScored = (second ? 1 : 0) + (third ? 1 : 0)
    return { first: null, second: 'Batter', third: first || null, runsScored }
  }
  if (['1B', 'BB', 'HBP', 'E', 'FC'].includes(outcome)) {
    runsScored = (first && second && third) ? 1 : 0
    return {
      first: 'Batter',
      second: first || null,
      third: second || (first && third ? third : null),
      runsScored,
    }
  }
  // Outs — don't advance
  return { first, second, third, runsScored: 0 }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OutsDots({ count }) {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map(i => (
        <span key={i} className="inline-block w-3 h-3 rounded-full border-2"
          style={{
            background: i < count ? 'var(--gold)' : 'transparent',
            borderColor: i < count ? 'var(--gold-dark, #b8891e)' : 'var(--border)',
          }} />
      ))}
    </div>
  )
}

function EndGameConfirm({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(43,62,80,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="card w-full max-w-sm rounded-t-2xl p-6 sheet-enter">
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
        <div className="font-display text-xl mb-1" style={{ color: 'var(--loss)' }}>END GAME?</div>
        <div className="text-sm mb-6" style={{ color: 'var(--navy-muted)' }}>
          Mark this game as final. The score will be saved from play data.
        </div>
        <button className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform mb-2"
          style={{ background: 'var(--loss)' }}
          onClick={onConfirm}>
          CONFIRM END GAME
        </button>
        <button className="w-full h-12 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          style={{ background: 'var(--sky)', color: 'var(--navy)' }}
          onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Scorebook ────────────────────────────────────────────────────────────

export default function Scorebook() {
  const { gameId, slug } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [state, setState] = useState(null)
  const [homeLineup, setHomeLineup] = useState([])
  const [awayLineup, setAwayLineup] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Scoring state machine
  const [phase, setPhase] = useState(PHASE.PITCH)
  const [currentPaId, setCurrentPaId] = useState(null)
  const [pitchLog, setPitchLog] = useState([])
  const [hitType, setHitType] = useState(null)
  const [hitLocation, setHitLocation] = useState(null)
  const [selectedFielder, setSelectedFielder] = useState(null)
  const [pendingOutcome, setPendingOutcome] = useState(null)
  const [pendingRunners, setPendingRunners] = useState({ first: null, second: null, third: null })
  const [pendingRuns, setPendingRuns] = useState(0)

  const [showEndGame, setShowEndGame] = useState(false)
  const [playLog, setPlayLog] = useState([])
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) navigate(`/${slug}/game/${gameId}/lineup`)
  }, [user, authLoading, slug, gameId, navigate])

  useEffect(() => {
    async function load() {
      try {
        const data = await getScorebookState(gameId)
        if (!data) { navigate(`/${slug}/game/${gameId}/lineup`); return }
        setState(data.state)
        setHomeLineup(data.homeLineup || [])
        setAwayLineup(data.awayLineup || [])
        // Initialize PA on load
        if (data.state?.status === 'in_progress') {
          startNextPA(data.state, data.homeLineup || [], data.awayLineup || [])
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gameId, slug, navigate])

  function showToast(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }

  async function syncState(patch) {
    setState(s => ({ ...s, ...patch }))
    try {
      await updateScorebookState(parseInt(gameId), patch)
    } catch {
      showToast('Sync error')
    }
  }

  // ── Lineup & Batter Logic ──────────────────────────────────────────────────

  const batterSide = state?.half === 'top' ? 'away' : 'home'
  const pitcherSide = state?.half === 'top' ? 'home' : 'away'
  const batterLineup = (batterSide === 'home' ? homeLineup : awayLineup).filter(e => e.active !== 0)
  const pitcherLineup = (pitcherSide === 'home' ? homeLineup : awayLineup).filter(e => e.active !== 0)

  const batterIdx = batterSide === 'home'
    ? (state?.home_batter_idx ?? 0)
    : (state?.away_batter_idx ?? 0)
  const currentBatter = batterLineup[batterIdx % batterLineup.length] || batterLineup[0]
  const currentPitcher = pitcherLineup.find(e => e.position === 'P' && e.active) || pitcherLineup[0]

  function advanceBatterIdx() {
    const newIdx = (batterIdx + 1) % (batterLineup.length || 1)
    const patch = batterSide === 'home'
      ? { homeBatterIdx: newIdx }
      : { awayBatterIdx: newIdx }
    syncState(patch)
  }

  // ── Start New PA ───────────────────────────────────────────────────────────

  async function startNextPA(s = state, hl = homeLineup, al = awayLineup) {
    const side = (s?.half === 'top') ? 'away' : 'home'
    const lineup = (side === 'home' ? hl : al).filter(e => e.active !== 0)
    const idx = side === 'home' ? (s?.home_batter_idx ?? 0) : (s?.away_batter_idx ?? 0)
    const batter = lineup[idx % lineup.length] || lineup[0]
    const pLineup = (side === 'home' ? al : hl).filter(e => e.active !== 0)
    const pitcher = pLineup.find(e => e.position === 'P' && e.active) || pLineup[0]

    try {
      const result = await startPlateAppearance(parseInt(gameId), {
        inning: s.inning,
        half: s.half,
        battingOrderPos: (idx % lineup.length) + 1,
        teamSide: side,
        playerName: batter?.player_name || 'Unknown',
        pitcherName: pitcher?.player_name || 'Unknown',
      })
      setCurrentPaId(result.paId)
    } catch {
      showToast('Error starting at-bat')
    }

    setPhase(PHASE.PITCH)
    setPitchLog([])
    setHitType(null)
    setHitLocation(null)
    setSelectedFielder(null)
    setPendingOutcome(null)
  }

  // ── Pitch Handling ─────────────────────────────────────────────────────────

  async function handlePitch(type) {
    if (!state || phase !== PHASE.PITCH) return
    const newLog = [...pitchLog, type]
    setPitchLog(newLog)

    let { balls, strikes } = state
    if (type === 'B') balls = Math.min(balls + 1, 4)
    else if (type === 'S' || type === 'C') strikes = Math.min(strikes + 1, 3)
    else if (type === 'F') strikes = Math.min(strikes + 1, 2) // foul can't be strike 3
    setState(s => ({ ...s, balls, strikes }))

    // Log pitch to server
    logPitch(parseInt(gameId), {
      paId: currentPaId,
      pitcherName: currentPitcher?.player_name || 'Unknown',
      pitcherTeamSide: pitcherSide,
      pitchType: type,
      inning: state.inning,
      half: state.half,
    }).catch(() => showToast('Sync error'))

    // Auto-detect strikeout
    if (strikes >= 3 && type !== 'F') {
      const kCode = type === 'C' ? 'Kl' : 'K'
      await completePA(kCode, null, null, null, null)
      return
    }

    // Auto-detect walk
    if (balls >= 4) {
      await completePA('BB', null, null, null, null)
      return
    }

    // "In Play" — transition to hit type (type 'X' is ball in play)
    if (type === 'X') {
      setPhase(PHASE.HIT_TYPE)
    }
  }

  function handleInPlay() {
    // Log as in-play pitch
    logPitch(parseInt(gameId), {
      paId: currentPaId,
      pitcherName: currentPitcher?.player_name || 'Unknown',
      pitcherTeamSide: pitcherSide,
      pitchType: 'X',
      inning: state.inning,
      half: state.half,
    }).catch(() => showToast('Sync error'))
    setPitchLog(prev => [...prev, 'X'])
    setPhase(PHASE.HIT_TYPE)
  }

  async function handleUndo() {
    if (pitchLog.length === 0) return
    const newLog = pitchLog.slice(0, -1)
    setPitchLog(newLog)
    let balls = 0, strikes = 0
    for (const t of newLog) {
      if (t === 'B') balls = Math.min(balls + 1, 3)
      else if (t === 'S' || t === 'C') strikes = Math.min(strikes + 1, 2)
      else if (t === 'F') strikes = Math.min(strikes + 1, 2)
    }
    setState(s => ({ ...s, balls, strikes }))
    try {
      await undoLastPitch(parseInt(gameId))
    } catch {
      showToast('Sync error')
    }
  }

  // ── Hit Flow ───────────────────────────────────────────────────────────────

  function handleHitType(code) {
    setHitType(code)
    setPhase(PHASE.FIELD_TAP)
  }

  function handleFieldTap(x, y) {
    setHitLocation({ x, y })
    setPhase(PHASE.FIELDER)
  }

  function handleFielderSelect(pos) {
    setSelectedFielder(pos)
    setPhase(PHASE.RESULT)
  }

  async function handleResult(code) {
    // Calculate runner advancement
    const runners = {
      first: state.runner_1b,
      second: state.runner_2b,
      third: state.runner_3b,
    }
    const { first, second, third, runsScored } = autoAdvanceRunners(runners, code)
    setPendingOutcome(code)
    setPendingRunners({ first, second, third })
    setPendingRuns(runsScored)
    setPhase(PHASE.RUNNERS)
  }

  async function confirmRunners() {
    await completePA(pendingOutcome, hitType, hitLocation, selectedFielder, pendingRuns)
    // Update runners on state
    await syncState({
      runner_1b: pendingRunners.first,
      runner_2b: pendingRunners.second,
      runner_3b: pendingRunners.third,
    })
  }

  // ── Complete a Plate Appearance ────────────────────────────────────────────

  async function completePA(outcome, ht, hitLoc, fielder, runsScored) {
    // Record outcome to server
    if (currentPaId) {
      await recordPlateAppearanceOutcome(parseInt(gameId), currentPaId, {
        outcome,
        rbi: runsScored ?? 0,
        pitchSequence: pitchLog.join(','),
        hitType: ht,
        hitX: hitLoc?.x,
        hitY: hitLoc?.y,
        fielder,
        runsScored: runsScored ?? 0,
      }).catch(() => {})
    }

    // Add to play log
    setPlayLog(prev => [{
      batter: currentBatter?.player_name || '?',
      outcome,
      hitType: ht,
      fielder,
      pitches: pitchLog.length,
    }, ...prev].slice(0, 20))

    const out = isOutcome(outcome)
    const newOuts = out ? state.outs + (outcome === 'DP' ? 2 : 1) : state.outs

    // Handle runners for non-in-play outcomes (K, BB, HBP)
    if (!hitLoc) {
      const runners = {
        first: state.runner_1b,
        second: state.runner_2b,
        third: state.runner_3b,
      }
      const { first, second, third, runsScored: rs } = autoAdvanceRunners(runners, outcome)
      await syncState({
        outs: Math.min(newOuts, 3),
        balls: 0,
        strikes: 0,
        runner_1b: first,
        runner_2b: second,
        runner_3b: third,
      })
    } else {
      await syncState({ outs: Math.min(newOuts, 3), balls: 0, strikes: 0 })
    }

    // Check for 3 outs — flip inning
    if (newOuts >= 3) {
      await flipInning()
    } else {
      advanceBatterIdx()
      startNextPA()
    }
  }

  async function flipInning() {
    // Auto-save R/H/E for the completed half-inning (from PA data)
    // Server calculates from plate_appearances, we just save a summary
    let newInning = state.inning
    let newHalf = state.half
    if (newHalf === 'top') {
      newHalf = 'bottom'
    } else {
      newHalf = 'top'
      newInning += 1
    }

    await syncState({
      inning: newInning,
      half: newHalf,
      outs: 0,
      balls: 0,
      strikes: 0,
      runner_1b: null,
      runner_2b: null,
      runner_3b: null,
    })

    showToast(`${newHalf === 'top' ? 'Top' : 'Bottom'} of ${ORDINALS[newInning] || newInning}`)

    // Start PA for new half
    const updatedState = { ...state, inning: newInning, half: newHalf, outs: 0, balls: 0, strikes: 0 }
    advanceBatterIdx()
    startNextPA(updatedState)
  }

  async function handleEndGame() {
    try {
      await endScorebookGame(parseInt(gameId), {})
      navigate(`/${slug}/game/${gameId}`)
    } catch (e) {
      showToast(e.message || 'Error ending game')
    }
    setShowEndGame(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-center py-12 text-sm" style={{ color: 'var(--loss)' }}>{error}</div>
  if (!state) return null

  const halfLabel = state.half === 'top' ? '▲' : '▼'
  const inningLabel = `${halfLabel} ${ORDINALS[state.inning] || `${state.inning}TH`}`

  return (
    <div className="space-y-3 pb-24">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold text-white"
          style={{ background: 'var(--navy)', maxWidth: '280px' }}>
          {toast}
        </div>
      )}

      {showEndGame && (
        <EndGameConfirm onConfirm={handleEndGame} onCancel={() => setShowEndGame(false)} />
      )}

      {/* ── Sticky Game State Bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-40 px-4 py-2 flex items-center justify-between border-b -mx-4"
        style={{ background: 'var(--sky)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-display text-xl tracking-wider" style={{ color: 'var(--navy)' }}>{inningLabel}</span>
        </div>
        <OutsDots count={state.outs} />
        <div className="flex items-center gap-1.5">
          <BasesDiamond
            runners={{ first: !!state.runner_1b, second: !!state.runner_2b, third: !!state.runner_3b }}
            size={32}
          />
          <Link to={`/${slug}/game/${gameId}/live`}
            className="text-[10px] font-bold px-2 py-1 rounded no-underline"
            style={{ background: 'rgba(43,62,80,0.1)', color: 'var(--navy)' }}>
            LIVE
          </Link>
        </div>
      </div>

      {/* ── Current Batter Card ────────────────────────────────────────── */}
      <div className="card px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="font-display text-xl" style={{ color: 'var(--navy)' }}>
              {currentBatter?.jersey_number ? `#${currentBatter.jersey_number} ` : ''}
              {currentBatter?.player_name || 'AT BAT'}
            </span>
            {currentBatter?.position && (
              <span className="text-xs ml-2" style={{ color: 'var(--navy-muted)' }}>{currentBatter.position}</span>
            )}
          </div>
          <div className="text-xs" style={{ color: 'var(--navy-muted)' }}>
            P: {currentPitcher?.player_name || '--'}
          </div>
        </div>

        {/* Count */}
        <div className="flex items-baseline justify-center gap-6 py-1">
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--navy-muted)' }}>B</div>
            <div className="font-display text-4xl leading-none" style={{ color: 'var(--win)' }}>{state.balls}</div>
          </div>
          <div className="font-display text-xl opacity-20" style={{ color: 'var(--navy)' }}>-</div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--navy-muted)' }}>S</div>
            <div className="font-display text-4xl leading-none" style={{ color: 'var(--loss)' }}>{state.strikes}</div>
          </div>
        </div>

        {/* Pitch log chips */}
        {pitchLog.length > 0 && (
          <div className="flex gap-1 overflow-x-auto mt-1 pb-1">
            {pitchLog.map((p, i) => (
              <span key={i} className="h-6 px-2 rounded-md font-display text-xs flex-shrink-0 flex items-center"
                style={{ background: PITCH_CHIP_STYLES[p]?.background, color: PITCH_CHIP_STYLES[p]?.color }}>
                {PITCH_CHIP_STYLES[p]?.label || p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── PHASE: PITCH ───────────────────────────────────────────────── */}
      {phase === PHASE.PITCH && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button className="h-16 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-transform select-none"
              style={{ background: 'var(--navy)', color: 'white' }}
              onClick={() => handlePitch('B')}>
              <span className="font-display text-2xl leading-none">BALL</span>
            </button>
            <button className="h-16 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-transform select-none"
              style={{ background: 'var(--loss)', color: 'white' }}
              onClick={() => handlePitch('C')}>
              <span className="font-display text-2xl leading-none">CALLED</span>
            </button>
            <button className="h-16 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-transform select-none"
              style={{ background: '#B86A2A', color: 'white' }}
              onClick={() => handlePitch('S')}>
              <span className="font-display text-2xl leading-none">SWINGING</span>
            </button>
            <button className="h-16 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-transform select-none"
              style={{ background: 'var(--gold-dark, #b8891e)', color: 'var(--navy)' }}
              onClick={() => handlePitch('F')}>
              <span className="font-display text-2xl leading-none">FOUL</span>
            </button>
          </div>

          {/* In Play + HBP */}
          <div className="grid grid-cols-2 gap-2">
            <button className="h-14 rounded-2xl font-display text-xl tracking-wider active:scale-95 transition-transform select-none"
              style={{ background: 'var(--win)', color: 'white' }}
              onClick={handleInPlay}>
              IN PLAY
            </button>
            <button className="h-14 rounded-2xl font-display text-xl tracking-wider active:scale-95 transition-transform select-none"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={() => completePA('HBP', null, null, null, null)}>
              HBP
            </button>
          </div>

          {/* Undo */}
          {pitchLog.length > 0 && (
            <button className="w-full h-10 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
              style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}
              onClick={handleUndo}>
              UNDO LAST PITCH
            </button>
          )}
        </>
      )}

      {/* ── PHASE: HIT TYPE ────────────────────────────────────────────── */}
      {phase === PHASE.HIT_TYPE && (
        <div className="card p-4">
          <div className="section-label mb-3">HIT TYPE</div>
          <div className="grid grid-cols-2 gap-2">
            {HIT_TYPES.map(ht => (
              <button key={ht.code}
                className="h-16 rounded-xl font-display text-base tracking-wider active:scale-95 transition-transform flex flex-col items-center justify-center gap-0.5"
                style={{ background: 'var(--sky)', color: 'var(--navy)' }}
                onClick={() => handleHitType(ht.code)}>
                <span className="text-xl">{ht.icon}</span>
                <span>{ht.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE: FIELD TAP ───────────────────────────────────────────── */}
      {phase === PHASE.FIELD_TAP && (
        <div className="card p-4">
          <div className="section-label mb-3">TAP WHERE THE BALL WAS FIELDED</div>
          <div className="flex justify-center">
            <FieldDiagram onTap={handleFieldTap} hitMark={hitLocation} size={280} />
          </div>
        </div>
      )}

      {/* ── PHASE: FIELDER ─────────────────────────────────────────────── */}
      {phase === PHASE.FIELDER && (
        <div className="card p-4">
          <div className="section-label mb-3">WHO FIELDED IT?</div>
          <div className="grid grid-cols-3 gap-2">
            {FIELDER_POSITIONS.map(pos => (
              <button key={pos}
                className="h-14 rounded-xl font-display text-lg tracking-wider active:scale-95 transition-transform"
                style={{ background: 'var(--navy)', color: 'white' }}
                onClick={() => handleFielderSelect(pos)}>
                {pos}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE: RESULT ──────────────────────────────────────────────── */}
      {phase === PHASE.RESULT && (
        <div className="card p-4">
          <div className="section-label mb-3">RESULT</div>

          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--navy-muted)' }}>OUTS</div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {RESULT_OPTIONS.out.map(r => (
              <button key={r.code}
                className="h-12 rounded-xl font-display text-sm tracking-wider active:scale-95 transition-transform"
                style={{ background: RESULT_STYLES[r.code]?.bg, color: RESULT_STYLES[r.code]?.color }}
                onClick={() => handleResult(r.code)}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--navy-muted)' }}>HITS</div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {RESULT_OPTIONS.hit.map(r => (
              <button key={r.code}
                className="h-12 rounded-xl font-display text-sm tracking-wider active:scale-95 transition-transform"
                style={{ background: RESULT_STYLES[r.code]?.bg, color: RESULT_STYLES[r.code]?.color }}
                onClick={() => handleResult(r.code)}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {RESULT_OPTIONS.error.map(r => (
              <button key={r.code}
                className="h-12 rounded-xl font-display text-sm tracking-wider active:scale-95 transition-transform"
                style={{ background: RESULT_STYLES[r.code]?.bg, color: RESULT_STYLES[r.code]?.color }}
                onClick={() => handleResult(r.code)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE: RUNNERS ─────────────────────────────────────────────── */}
      {phase === PHASE.RUNNERS && (
        <div className="card p-4">
          <div className="section-label mb-2">CONFIRM RUNNERS</div>
          <div className="text-sm mb-3" style={{ color: 'var(--navy-muted)' }}>
            {pendingOutcome} — {pendingRuns > 0 ? `${pendingRuns} run(s) scored` : 'No runs scored'}
          </div>
          <div className="flex justify-center mb-4">
            <BasesDiamond
              runners={{
                first: !!pendingRunners.first,
                second: !!pendingRunners.second,
                third: !!pendingRunners.third,
              }}
              interactive={true}
              onToggle={(base) => {
                const key = { first: 'first', second: 'second', third: 'third' }[base]
                setPendingRunners(prev => ({
                  ...prev,
                  [key]: prev[key] ? null : 'Runner',
                }))
              }}
              size={140}
            />
          </div>
          <div className="flex gap-2 mb-2">
            <button className="flex-1 h-8 rounded-lg text-xs font-bold active:scale-95"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={() => setPendingRuns(r => Math.max(0, r - 1))}>
              - RUN
            </button>
            <div className="flex items-center px-3 font-display text-lg" style={{ color: 'var(--navy)' }}>
              {pendingRuns} R
            </div>
            <button className="flex-1 h-8 rounded-lg text-xs font-bold active:scale-95"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={() => setPendingRuns(r => r + 1)}>
              + RUN
            </button>
          </div>
          <button
            className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
            style={{ background: 'var(--navy)' }}
            onClick={confirmRunners}>
            CONFIRM
          </button>
        </div>
      )}

      {/* ── Play Log ───────────────────────────────────────────────────── */}
      {playLog.length > 0 && (
        <div>
          <div className="section-label mb-2">PLAY LOG</div>
          <div className="card overflow-hidden">
            {playLog.map((play, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 text-sm"
                style={{ borderColor: 'var(--border)' }}>
                <span className="font-semibold truncate flex-1" style={{ color: 'var(--navy)' }}>
                  {play.batter}
                </span>
                <span className="font-display text-sm px-2 py-0.5 rounded"
                  style={{
                    background: RESULT_STYLES[play.outcome]?.bg || 'var(--sky)',
                    color: RESULT_STYLES[play.outcome]?.color || 'var(--navy)',
                  }}>
                  {play.outcome}
                </span>
                {play.hitType && (
                  <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>{play.hitType}</span>
                )}
                {play.fielder && (
                  <span className="text-xs font-bold" style={{ color: 'var(--navy-muted)' }}>{play.fielder}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── End Game ───────────────────────────────────────────────────── */}
      <button
        className="w-full h-12 rounded-xl font-display text-lg tracking-widest text-white active:scale-95 transition-transform mt-4"
        style={{ background: 'var(--loss)' }}
        onClick={() => setShowEndGame(true)}>
        END GAME
      </button>
    </div>
  )
}
