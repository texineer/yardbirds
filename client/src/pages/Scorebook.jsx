import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getScorebookState, updateScorebookState, getGameScore,
  logPitch, undoLastPitch, startPlateAppearance, recordPlateAppearanceOutcome,
  endScorebookGame,
} from '../api'
import { useAuth } from '../context/AuthContext'
import GameDiamond from '../components/GameDiamond'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Constants ─────────────────────────────────────────────────────────────────

const ORDINALS = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH', '11TH', '12TH']

const PITCH_CHIP = {
  B: { bg: 'var(--win-bg, #eaf5ee)', color: 'var(--win)', label: 'B' },
  C: { bg: 'var(--loss-bg, #fdecea)', color: 'var(--loss)', label: 'C' },
  S: { bg: 'rgba(184,106,42,0.15)', color: '#B86A2A', label: 'S' },
  F: { bg: 'rgba(212,168,50,0.15)', color: 'var(--gold-dark, #b8891e)', label: 'F' },
  X: { bg: 'var(--win-bg, #eaf5ee)', color: 'var(--win)', label: 'X' },
}

const HIT_TYPES = [
  { code: 'GB', label: 'GROUND BALL' },
  { code: 'LD', label: 'LINE DRIVE' },
  { code: 'FB', label: 'FLY BALL' },
  { code: 'PU', label: 'POPUP' },
]

const FIELDERS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const RESULTS = {
  outs: [
    { code: 'GO', label: 'Ground Out' },
    { code: 'FO', label: 'Fly Out' },
    { code: 'LO', label: 'Line Out' },
    { code: 'DP', label: 'Double Play' },
    { code: 'SAC', label: 'Sacrifice' },
    { code: 'FC', label: "Fielder's Choice" },
  ],
  hits: [
    { code: '1B', label: 'Single' },
    { code: '2B', label: 'Double' },
    { code: '3B', label: 'Triple' },
    { code: 'HR', label: 'Home Run' },
  ],
  other: [
    { code: 'E', label: 'Error' },
  ],
}

const R_STYLES = {
  GO: '#e74c3c', FO: '#e74c3c', LO: '#e74c3c', DP: '#e74c3c',
  SAC: '#8aafb6', FC: '#8aafb6', K: '#e74c3c', Kl: '#e74c3c',
  '1B': '#2b3e50', '2B': '#2b3e50', '3B': '#2b3e50', HR: '#d4a832',
  E: '#27ae60', BB: '#27ae60', HBP: '#27ae60',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOut(code) { return ['GO', 'FO', 'LO', 'DP', 'SAC', 'FC', 'K', 'Kl'].includes(code) }

function autoAdvance(runners, outcome) {
  let { first, second, third } = runners
  let runs = 0
  if (outcome === 'HR') {
    runs = (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0) + 1
    return { first: null, second: null, third: null, runs }
  }
  if (outcome === '3B') {
    runs = (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0)
    return { first: null, second: null, third: 'Batter', runs }
  }
  if (outcome === '2B') {
    runs = (second ? 1 : 0) + (third ? 1 : 0)
    return { first: null, second: 'Batter', third: first || null, runs }
  }
  if (['1B', 'BB', 'HBP', 'E', 'FC'].includes(outcome)) {
    runs = (first && second && third) ? 1 : 0
    return { first: 'Batter', second: first || null, third: second || null, runs }
  }
  return { first, second, third, runs: 0 }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Scorebook() {
  const { gameId, slug } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // Game data
  const [state, setState] = useState(null)
  const [homeLineup, setHomeLineup] = useState([])
  const [awayLineup, setAwayLineup] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [score, setScore] = useState({ homeScore: 0, awayScore: 0 })

  // Scoring
  const [currentPaId, setCurrentPaId] = useState(null)
  const [pitchLog, setPitchLog] = useState([])
  const [showInPlay, setShowInPlay] = useState(false)
  const [showRunners, setShowRunners] = useState(false)
  const [showEndGame, setShowEndGame] = useState(false)

  // In-play wizard state
  const [ipHitType, setIpHitType] = useState(null)
  const [ipHitLoc, setIpHitLoc] = useState(null)
  const [ipFielder, setIpFielder] = useState(null)
  const [ipStep, setIpStep] = useState(0) // 0=hitType, 1=fieldTap, 2=fielder, 3=result

  // Runner confirmation
  const [pendingRunners, setPendingRunners] = useState({ first: null, second: null, third: null })
  const [pendingRuns, setPendingRuns] = useState(0)
  const [pendingOutcome, setPendingOutcome] = useState(null)

  const [playLog, setPlayLog] = useState([])
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  // ── Auth redirect ──
  useEffect(() => {
    if (!authLoading && !user) navigate(`/${slug}/game/${gameId}/lineup`)
  }, [user, authLoading])

  // ── Load game data ──
  useEffect(() => {
    async function load() {
      try {
        const data = await getScorebookState(gameId)
        if (!data) { navigate(`/${slug}/game/${gameId}/lineup`); return }
        setState(data.state)
        setHomeLineup(data.homeLineup || [])
        setAwayLineup(data.awayLineup || [])
        if (data.state?.status === 'in_progress') {
          startNextPA(data.state, data.homeLineup || [], data.awayLineup || [])
        }
        // Load score
        const s = await getGameScore(gameId).catch(() => ({ homeScore: 0, awayScore: 0 }))
        setScore(s)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gameId])

  function showToastMsg(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  async function syncState(patch) {
    setState(s => ({ ...s, ...patch }))
    try { await updateScorebookState(parseInt(gameId), patch) } catch {}
  }

  async function refreshScore() {
    const s = await getGameScore(gameId).catch(() => score)
    setScore(s)
  }

  // ── Lineup / Batter Logic ──
  const batterSide = state?.half === 'top' ? 'away' : 'home'
  const pitcherSide = state?.half === 'top' ? 'home' : 'away'
  const batterLineup = (batterSide === 'home' ? homeLineup : awayLineup).filter(e => e.active !== 0)
  const pitcherLineup = (pitcherSide === 'home' ? homeLineup : awayLineup).filter(e => e.active !== 0)
  const batterIdx = batterSide === 'home' ? (state?.home_batter_idx ?? 0) : (state?.away_batter_idx ?? 0)
  const currentBatter = batterLineup.length > 0 ? (batterLineup[batterIdx % batterLineup.length] || batterLineup[0]) : null
  const currentPitcher = pitcherLineup.find(e => e.position === 'P' && e.active) || pitcherLineup[0] || null

  function advanceBatterIdx(s = state, hl = homeLineup, al = awayLineup) {
    const side = (s?.half === 'top') ? 'away' : 'home'
    const lineup = (side === 'home' ? hl : al).filter(e => e.active !== 0)
    if (lineup.length === 0) return
    const idx = side === 'home' ? (s?.home_batter_idx ?? 0) : (s?.away_batter_idx ?? 0)
    const newIdx = (idx + 1) % lineup.length
    syncState(side === 'home' ? { homeBatterIdx: newIdx } : { awayBatterIdx: newIdx })
  }

  // ── Start PA ──
  async function startNextPA(s = state, hl = homeLineup, al = awayLineup) {
    if (!s) return
    const side = (s.half === 'top') ? 'away' : 'home'
    const lineup = (side === 'home' ? hl : al).filter(e => e.active !== 0)
    if (lineup.length === 0) return
    const idx = side === 'home' ? (s.home_batter_idx ?? 0) : (s.away_batter_idx ?? 0)
    const batter = lineup[idx % lineup.length]
    const pLineup = (side === 'home' ? al : hl).filter(e => e.active !== 0)
    const pitcher = pLineup.find(e => e.position === 'P' && e.active) || pLineup[0]

    try {
      const result = await startPlateAppearance(parseInt(gameId), {
        inning: s.inning, half: s.half,
        battingOrderPos: (idx % lineup.length) + 1,
        teamSide: side,
        playerName: batter?.player_name || 'Unknown',
        pitcherName: pitcher?.player_name || 'Unknown',
      })
      setCurrentPaId(result.paId)
    } catch (err) { console.error('startPA:', err) }

    setPitchLog([])
    setShowInPlay(false)
    setShowRunners(false)
    resetInPlay()
  }

  function resetInPlay() {
    setIpHitType(null)
    setIpHitLoc(null)
    setIpFielder(null)
    setIpStep(0)
  }

  // ── Pitch ──
  async function handlePitch(type) {
    if (!state) return
    const newLog = [...pitchLog, type]
    setPitchLog(newLog)

    let { balls, strikes } = state
    if (type === 'B') balls = Math.min(balls + 1, 4)
    else if (type === 'S' || type === 'C') strikes = Math.min(strikes + 1, 3)
    else if (type === 'F') strikes = Math.min(strikes + 1, 2)
    setState(s => ({ ...s, balls, strikes }))

    logPitch(parseInt(gameId), {
      paId: currentPaId,
      pitcherName: currentPitcher?.player_name || 'Unknown',
      pitcherTeamSide: pitcherSide,
      pitchType: type, inning: state.inning, half: state.half,
    }).catch(() => {})

    // Auto-K
    if (strikes >= 3 && type !== 'F') {
      await finishPA(type === 'C' ? 'Kl' : 'K', null, null, null, newLog)
      return
    }
    // Auto-BB
    if (balls >= 4) {
      await finishPA('BB', null, null, null, newLog)
      return
    }
  }

  function handleInPlay() {
    logPitch(parseInt(gameId), {
      paId: currentPaId,
      pitcherName: currentPitcher?.player_name || 'Unknown',
      pitcherTeamSide: pitcherSide,
      pitchType: 'X', inning: state.inning, half: state.half,
    }).catch(() => {})
    setPitchLog(prev => [...prev, 'X'])
    resetInPlay()
    setShowInPlay(true)
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
    try { await undoLastPitch(parseInt(gameId)) } catch {}
  }

  // ── In-Play Result ──
  function handleInPlayResult(code) {
    setShowInPlay(false)
    const runners = { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }
    const adv = autoAdvance(runners, code)
    setPendingOutcome(code)
    setPendingRunners(adv)
    setPendingRuns(adv.runs)
    setShowRunners(true)
  }

  // ── HBP ──
  function handleHBP() {
    const runners = { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }
    const adv = autoAdvance(runners, 'HBP')
    setPendingOutcome('HBP')
    setPendingRunners(adv)
    setPendingRuns(adv.runs)
    setShowRunners(true)
  }

  // ── Confirm Runners → Complete PA ──
  async function confirmRunners() {
    await finishPA(pendingOutcome, ipHitType, ipHitLoc, ipFielder, pitchLog)
    await syncState({
      runner_1b: pendingRunners.first, runner_2b: pendingRunners.second, runner_3b: pendingRunners.third,
    })
    setShowRunners(false)
  }

  // ── Finish a PA ──
  async function finishPA(outcome, hitType, hitLoc, fielder, pLog = pitchLog) {
    if (currentPaId) {
      const runners = { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }
      const adv = autoAdvance(runners, outcome)

      await recordPlateAppearanceOutcome(parseInt(gameId), currentPaId, {
        outcome, rbi: adv.runs, pitchSequence: pLog.join(','),
        hitType, hitX: hitLoc?.x, hitY: hitLoc?.y, fielder, runsScored: adv.runs,
      }).catch(() => {})

      // For non-in-play (K, BB, HBP), update runners directly
      if (!showRunners) {
        await syncState({
          runner_1b: adv.first, runner_2b: adv.second, runner_3b: adv.third,
        })
      }
    }

    setPlayLog(prev => [{
      batter: currentBatter?.player_name || '?',
      outcome, hitType, fielder,
    }, ...prev].slice(0, 10))

    const outCount = isOut(outcome) ? (outcome === 'DP' ? 2 : 1) : 0
    const newOuts = (state?.outs || 0) + outCount

    await syncState({ outs: Math.min(newOuts, 3), balls: 0, strikes: 0 })

    if (newOuts >= 3) {
      await flipInning()
    } else {
      advanceBatterIdx()
      startNextPA()
    }
    refreshScore()
  }

  async function flipInning() {
    let newInning = state.inning
    let newHalf = state.half
    if (newHalf === 'top') { newHalf = 'bottom' }
    else { newHalf = 'top'; newInning += 1 }

    await syncState({
      inning: newInning, half: newHalf, outs: 0, balls: 0, strikes: 0,
      runner_1b: null, runner_2b: null, runner_3b: null,
    })
    showToastMsg(`${newHalf === 'top' ? 'Top' : 'Bottom'} ${ORDINALS[newInning] || newInning}`)
    advanceBatterIdx({ ...state, inning: newInning, half: newHalf })
    startNextPA({ ...state, inning: newInning, half: newHalf, outs: 0, balls: 0, strikes: 0 })
  }

  async function handleEndGame() {
    try {
      await endScorebookGame(parseInt(gameId), {})
      navigate(`/${slug}/game/${gameId}`)
    } catch (e) { showToastMsg(e.message || 'Error') }
    setShowEndGame(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-center py-12 text-sm" style={{ color: 'var(--loss)' }}>{error}</div>
  if (!state) return (
    <div className="text-center py-12">
      <div className="font-display text-xl mb-2" style={{ color: 'var(--navy)' }}>NO SCOREBOOK DATA</div>
      <Link to={`/${slug}/game/${gameId}/lineup`} className="text-sm font-bold no-underline" style={{ color: 'var(--gold-dark)' }}>
        Go to lineup setup
      </Link>
    </div>
  )

  const halfLabel = state.half === 'top' ? '▲' : '▼'
  const inningText = ORDINALS[state.inning] || `${state.inning}TH`
  const homeName = state.home_team_name?.split(' ').pop() || 'HOME'
  const awayName = state.away_team_name?.split(' ').pop() || 'AWAY'

  return (
    <div className="pb-24 -mx-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold text-white"
          style={{ background: 'var(--navy)' }}>
          {toast}
        </div>
      )}

      {/* ── SCOREBOARD BAR ── */}
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'var(--navy)' }}>
        <div className="text-center flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white opacity-60">{state.away_team_name}</div>
          <div className="font-display text-2xl text-white">{score.awayScore}</div>
        </div>
        <div className="text-center px-4">
          <div className="font-display text-lg tracking-wider" style={{ color: 'var(--gold)' }}>
            {halfLabel} {inningText}
          </div>
          <div className="flex justify-center gap-1 mt-0.5">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2.5 h-2.5 rounded-full"
                style={{ background: i < state.outs ? 'var(--gold)' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white opacity-60">{state.home_team_name}</div>
          <div className="font-display text-2xl text-white">{score.homeScore}</div>
        </div>
      </div>

      {/* ── DIAMOND ── */}
      <div style={{ background: '#2d5a27' }} className="py-2">
        <GameDiamond
          runners={showRunners ? pendingRunners : {
            first: state.runner_1b,
            second: state.runner_2b,
            third: state.runner_3b,
          }}
          batter={currentBatter}
          pitcher={currentPitcher}
          interactive={showRunners}
          onBaseClick={showRunners ? (base) => {
            setPendingRunners(prev => ({
              ...prev,
              [base]: prev[base] ? null : 'Runner',
            }))
          } : undefined}
          dragMode={showInPlay && ipStep === 1}
          onBallDrop={(x, y) => { setIpHitLoc({ x, y }); setIpStep(2) }}
          hitMark={ipHitLoc}
          size={320}
        />
      </div>

      {/* ── BATTER CARD + COUNT ── */}
      <div className="px-4 py-3" style={{ background: 'var(--cream)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="font-display text-lg" style={{ color: 'var(--navy)' }}>
            {currentBatter?.jersey_number ? `#${currentBatter.jersey_number} ` : ''}
            {currentBatter?.player_name || 'AT BAT'}
            {currentBatter?.position && (
              <span className="text-xs ml-1.5 font-normal" style={{ color: 'var(--navy-muted)' }}>{currentBatter.position}</span>
            )}
          </div>
          <div className="text-xs" style={{ color: 'var(--navy-muted)' }}>
            P: {currentPitcher?.player_name || '--'}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="font-display text-3xl" style={{ color: 'var(--win)' }}>{state.balls}</span>
            <span className="text-xs font-bold" style={{ color: 'var(--navy-muted)' }}>-</span>
            <span className="font-display text-3xl" style={{ color: 'var(--loss)' }}>{state.strikes}</span>
          </div>
          {pitchLog.length > 0 && (
            <div className="flex gap-1 overflow-x-auto flex-1">
              {pitchLog.map((p, i) => (
                <span key={i} className="h-5 px-1.5 rounded text-[10px] font-bold flex-shrink-0 flex items-center"
                  style={{ background: PITCH_CHIP[p]?.bg, color: PITCH_CHIP[p]?.color }}>
                  {PITCH_CHIP[p]?.label || p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PITCH BUTTONS (always visible unless overlay) ── */}
      {!showInPlay && !showRunners && !showEndGame && (
        <div className="px-4 py-3 space-y-2" style={{ background: 'white', borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-4 gap-2">
            <button className="h-14 rounded-xl font-display text-base active:scale-95 transition-transform"
              style={{ background: 'var(--navy)', color: 'white' }}
              onClick={() => handlePitch('B')}>BALL</button>
            <button className="h-14 rounded-xl font-display text-base active:scale-95 transition-transform"
              style={{ background: 'var(--loss)', color: 'white' }}
              onClick={() => handlePitch('C')}>CALLED</button>
            <button className="h-14 rounded-xl font-display text-base active:scale-95 transition-transform"
              style={{ background: '#B86A2A', color: 'white' }}
              onClick={() => handlePitch('S')}>SWING</button>
            <button className="h-14 rounded-xl font-display text-base active:scale-95 transition-transform"
              style={{ background: 'var(--gold-dark, #b8891e)', color: 'var(--navy)' }}
              onClick={() => handlePitch('F')}>FOUL</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button className="h-12 rounded-xl font-display text-lg tracking-wider col-span-2 active:scale-95 transition-transform"
              style={{ background: 'var(--win)', color: 'white' }}
              onClick={handleInPlay}>
              IN PLAY
            </button>
            <button className="h-12 rounded-xl font-display text-base active:scale-95 transition-transform"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={handleHBP}>HBP</button>
          </div>
          <div className="flex gap-2">
            {pitchLog.length > 0 && (
              <button className="flex-1 h-9 rounded-lg text-xs font-semibold active:scale-95"
                style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}
                onClick={handleUndo}>UNDO</button>
            )}
            <button className="h-9 px-4 rounded-lg text-xs font-semibold active:scale-95"
              style={{ color: 'var(--navy-muted)', background: 'var(--sky)' }}
              onClick={() => setShowEndGame(true)}>END GAME</button>
          </div>
        </div>
      )}

      {/* ── IN PLAY OVERLAY ── */}
      {showInPlay && (
        <div className="px-4 py-3 space-y-3" style={{ background: 'white', borderTop: '2px solid var(--gold)' }}>
          <div className="flex items-center justify-between">
            <div className="font-display text-lg" style={{ color: 'var(--navy)' }}>IN PLAY</div>
            <button className="text-xs font-bold px-2 py-1 rounded"
              style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}
              onClick={() => { setShowInPlay(false); resetInPlay() }}>CANCEL</button>
          </div>

          {/* Step 0: Hit Type */}
          {ipStep === 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--navy-muted)' }}>HIT TYPE</div>
              <div className="grid grid-cols-4 gap-1.5">
                {HIT_TYPES.map(ht => (
                  <button key={ht.code}
                    className="h-12 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    style={{ background: ipHitType === ht.code ? 'var(--navy)' : 'var(--sky)', color: ipHitType === ht.code ? 'white' : 'var(--navy)' }}
                    onClick={() => { setIpHitType(ht.code); setIpStep(1) }}>
                    {ht.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 1: Drag ball on diamond (handled by GameDiamond dragMode above) */}
          {ipStep === 1 && (
            <div className="text-center py-4">
              <div className="font-display text-base mb-1" style={{ color: 'var(--navy)' }}>DRAG THE ⚾ ON THE DIAMOND</div>
              <div className="text-xs" style={{ color: 'var(--navy-muted)' }}>Drag the ball to where it was hit or fielded</div>
            </div>
          )}

          {/* Step 2: Fielder */}
          {ipStep === 2 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--navy-muted)' }}>WHO FIELDED IT?</div>
              <div className="grid grid-cols-3 gap-1.5">
                {FIELDERS.map(pos => (
                  <button key={pos}
                    className="h-11 rounded-xl font-display text-base active:scale-95 transition-transform"
                    style={{ background: 'var(--navy)', color: 'white' }}
                    onClick={() => { setIpFielder(pos); setIpStep(3) }}>
                    {pos}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Result */}
          {ipStep === 3 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--navy-muted)' }}>OUTS</div>
              <div className="grid grid-cols-3 gap-1.5">
                {RESULTS.outs.map(r => (
                  <button key={r.code}
                    className="h-10 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    style={{ background: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' }}
                    onClick={() => handleInPlayResult(r.code)}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--navy-muted)' }}>HITS</div>
              <div className="grid grid-cols-4 gap-1.5">
                {RESULTS.hits.map(r => (
                  <button key={r.code}
                    className="h-10 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    style={{ background: r.code === 'HR' ? 'var(--gold)' : 'var(--sky)', color: 'var(--navy)' }}
                    onClick={() => handleInPlayResult(r.code)}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button className="w-full h-10 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: 'var(--win-bg, #eaf5ee)', color: 'var(--win)' }}
                onClick={() => handleInPlayResult('E')}>
                Error
              </button>
            </>
          )}
        </div>
      )}

      {/* ── RUNNERS OVERLAY ── */}
      {showRunners && (
        <div className="px-4 py-3 space-y-3" style={{ background: 'white', borderTop: '2px solid var(--gold)' }}>
          <div className="font-display text-lg" style={{ color: 'var(--navy)' }}>
            {pendingOutcome} — CONFIRM RUNNERS
          </div>
          <div className="text-sm" style={{ color: 'var(--navy-muted)' }}>
            Tap bases on diamond above to adjust. {pendingRuns > 0 ? `${pendingRuns} run(s) scored.` : 'No runs.'}
          </div>
          <div className="flex items-center gap-3">
            <button className="h-9 px-3 rounded-lg text-xs font-bold active:scale-95"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={() => setPendingRuns(r => Math.max(0, r - 1))}>- RUN</button>
            <span className="font-display text-xl" style={{ color: 'var(--navy)' }}>{pendingRuns} R</span>
            <button className="h-9 px-3 rounded-lg text-xs font-bold active:scale-95"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={() => setPendingRuns(r => r + 1)}>+ RUN</button>
          </div>
          <button
            className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
            style={{ background: 'var(--navy)' }}
            onClick={confirmRunners}>
            CONFIRM
          </button>
        </div>
      )}

      {/* ── END GAME ── */}
      {showEndGame && (
        <div className="px-4 py-3 space-y-3" style={{ background: 'white', borderTop: '2px solid var(--loss)' }}>
          <div className="font-display text-xl" style={{ color: 'var(--loss)' }}>END GAME?</div>
          <div className="text-sm" style={{ color: 'var(--navy-muted)' }}>Final score will be saved from play data.</div>
          <button className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95"
            style={{ background: 'var(--loss)' }}
            onClick={handleEndGame}>CONFIRM END GAME</button>
          <button className="w-full h-10 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--sky)', color: 'var(--navy)' }}
            onClick={() => setShowEndGame(false)}>Cancel</button>
        </div>
      )}

      {/* ── PLAY LOG ── */}
      {playLog.length > 0 && (
        <div className="px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--navy-muted)' }}>PLAYS</div>
          <div className="space-y-1">
            {playLog.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 px-2 rounded"
                style={{ background: i === 0 ? 'rgba(212,168,50,0.08)' : 'transparent' }}>
                <span className="font-semibold truncate flex-1" style={{ color: 'var(--navy)' }}>{p.batter}</span>
                <span className="font-display text-xs px-1.5 py-0.5 rounded"
                  style={{ background: R_STYLES[p.outcome] ? `${R_STYLES[p.outcome]}20` : 'var(--sky)', color: R_STYLES[p.outcome] || 'var(--navy)' }}>
                  {p.outcome}
                </span>
                {p.fielder && <span className="text-[10px] font-bold" style={{ color: 'var(--navy-muted)' }}>{p.fielder}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE link */}
      <div className="px-4 py-2 text-center">
        <Link to={`/${slug}/game/${gameId}/live`}
          className="text-xs font-bold no-underline px-3 py-1.5 rounded"
          style={{ background: 'var(--sky)', color: 'var(--navy)' }}>
          SHARE LIVE VIEW
        </Link>
      </div>
    </div>
  )
}
