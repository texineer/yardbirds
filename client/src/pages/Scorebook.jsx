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
  B: { bg: '#1B7340', color: '#fff', label: 'B' },
  C: { bg: '#B8302A', color: '#fff', label: 'C' },
  S: { bg: '#B86A2A', color: '#fff', label: 'S' },
  F: { bg: '#D4A832', color: '#2B3E50', label: 'F' },
  X: { bg: '#1B7340', color: '#fff', label: 'X' },
}

const HIT_TYPES = [
  { code: 'GB', label: 'GROUNDER', icon: '↘' },
  { code: 'LD', label: 'LINER', icon: '→' },
  { code: 'FB', label: 'FLY', icon: '↗' },
  { code: 'PU', label: 'POP UP', icon: '↑' },
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
    { code: '1B', label: '1B' },
    { code: '2B', label: '2B' },
    { code: '3B', label: '3B' },
    { code: 'HR', label: 'HR' },
  ],
  other: [
    { code: 'E', label: 'Error' },
  ],
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

// ── Scorebook ─────────────────────────────────────────────────────────────────

export default function Scorebook() {
  const { gameId, slug } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [state, setState] = useState(null)
  const [homeLineup, setHomeLineup] = useState([])
  const [awayLineup, setAwayLineup] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [score, setScore] = useState({ homeScore: 0, awayScore: 0 })

  const [currentPaId, setCurrentPaId] = useState(null)
  const [pitchLog, setPitchLog] = useState([])
  const [showInPlay, setShowInPlay] = useState(false)
  const [showRunners, setShowRunners] = useState(false)
  const [showEndGame, setShowEndGame] = useState(false)

  const [ipHitType, setIpHitType] = useState(null)
  const [ipHitLoc, setIpHitLoc] = useState(null)
  const [ipFielder, setIpFielder] = useState(null)
  const [ipStep, setIpStep] = useState(0)

  const [pendingRunners, setPendingRunners] = useState({ first: null, second: null, third: null })
  const [pendingRuns, setPendingRuns] = useState(0)
  const [pendingOutcome, setPendingOutcome] = useState(null)

  const [playLog, setPlayLog] = useState([])
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    if (!authLoading && !user) navigate(`/${slug}/game/${gameId}/lineup`)
  }, [user, authLoading])

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
        const s = await getGameScore(gameId).catch(() => ({ homeScore: 0, awayScore: 0 }))
        setScore(s)
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
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
    syncState(side === 'home' ? { homeBatterIdx: (idx + 1) % lineup.length } : { awayBatterIdx: (idx + 1) % lineup.length })
  }

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
        inning: s.inning, half: s.half, battingOrderPos: (idx % lineup.length) + 1,
        teamSide: side, playerName: batter?.player_name || 'Unknown', pitcherName: pitcher?.player_name || 'Unknown',
      })
      setCurrentPaId(result.paId)
    } catch (err) { console.error('startPA:', err) }
    setPitchLog([]); setShowInPlay(false); setShowRunners(false); resetInPlay()
  }

  function resetInPlay() { setIpHitType(null); setIpHitLoc(null); setIpFielder(null); setIpStep(0) }

  async function handlePitch(type) {
    if (!state) return
    const newLog = [...pitchLog, type]
    setPitchLog(newLog)
    let { balls, strikes } = state
    if (type === 'B') balls = Math.min(balls + 1, 4)
    else if (type === 'S' || type === 'C') strikes = Math.min(strikes + 1, 3)
    else if (type === 'F') strikes = Math.min(strikes + 1, 2)
    setState(s => ({ ...s, balls, strikes }))
    logPitch(parseInt(gameId), { paId: currentPaId, pitcherName: currentPitcher?.player_name || 'Unknown', pitcherTeamSide: pitcherSide, pitchType: type, inning: state.inning, half: state.half }).catch(() => {})
    if (strikes >= 3 && type !== 'F') { await finishPA(type === 'C' ? 'Kl' : 'K', null, null, null, newLog); return }
    if (balls >= 4) { await finishPA('BB', null, null, null, newLog); return }
  }

  function handleInPlay() {
    logPitch(parseInt(gameId), { paId: currentPaId, pitcherName: currentPitcher?.player_name || 'Unknown', pitcherTeamSide: pitcherSide, pitchType: 'X', inning: state.inning, half: state.half }).catch(() => {})
    setPitchLog(prev => [...prev, 'X']); resetInPlay(); setShowInPlay(true)
  }

  async function handleUndo() {
    if (pitchLog.length === 0) return
    const newLog = pitchLog.slice(0, -1); setPitchLog(newLog)
    let balls = 0, strikes = 0
    for (const t of newLog) { if (t === 'B') balls = Math.min(balls + 1, 3); else if (t === 'S' || t === 'C') strikes = Math.min(strikes + 1, 2); else if (t === 'F') strikes = Math.min(strikes + 1, 2) }
    setState(s => ({ ...s, balls, strikes }))
    try { await undoLastPitch(parseInt(gameId)) } catch {}
  }

  function handleInPlayResult(code) {
    setShowInPlay(false)
    const runners = { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }
    const adv = autoAdvance(runners, code)
    setPendingOutcome(code); setPendingRunners(adv); setPendingRuns(adv.runs); setShowRunners(true)
  }

  function handleHBP() {
    const runners = { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }
    const adv = autoAdvance(runners, 'HBP')
    setPendingOutcome('HBP'); setPendingRunners(adv); setPendingRuns(adv.runs); setShowRunners(true)
  }

  async function confirmRunners() {
    await finishPA(pendingOutcome, ipHitType, ipHitLoc, ipFielder, pitchLog)
    await syncState({ runner_1b: pendingRunners.first, runner_2b: pendingRunners.second, runner_3b: pendingRunners.third })
    setShowRunners(false)
  }

  async function finishPA(outcome, hitType, hitLoc, fielder, pLog = pitchLog) {
    if (currentPaId) {
      const runners = { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }
      const adv = autoAdvance(runners, outcome)
      await recordPlateAppearanceOutcome(parseInt(gameId), currentPaId, { outcome, rbi: adv.runs, pitchSequence: pLog.join(','), hitType, hitX: hitLoc?.x, hitY: hitLoc?.y, fielder, runsScored: adv.runs }).catch(() => {})
      if (!showRunners) await syncState({ runner_1b: adv.first, runner_2b: adv.second, runner_3b: adv.third })
    }
    setPlayLog(prev => [{ batter: currentBatter?.player_name || '?', outcome, hitType, fielder }, ...prev].slice(0, 10))
    const outCount = isOut(outcome) ? (outcome === 'DP' ? 2 : 1) : 0
    const newOuts = (state?.outs || 0) + outCount
    await syncState({ outs: Math.min(newOuts, 3), balls: 0, strikes: 0 })
    if (newOuts >= 3) await flipInning()
    else { advanceBatterIdx(); startNextPA() }
    refreshScore()
  }

  async function flipInning() {
    let newInning = state.inning, newHalf = state.half
    if (newHalf === 'top') newHalf = 'bottom'; else { newHalf = 'top'; newInning += 1 }
    await syncState({ inning: newInning, half: newHalf, outs: 0, balls: 0, strikes: 0, runner_1b: null, runner_2b: null, runner_3b: null })
    showToastMsg(`${newHalf === 'top' ? 'Top' : 'Bottom'} ${ORDINALS[newInning] || newInning}`)
    advanceBatterIdx({ ...state, inning: newInning, half: newHalf })
    startNextPA({ ...state, inning: newInning, half: newHalf, outs: 0, balls: 0, strikes: 0 })
  }

  async function handleEndGame() {
    try { await endScorebookGame(parseInt(gameId), {}); navigate(`/${slug}/game/${gameId}`) }
    catch (e) { showToastMsg(e.message || 'Error') }
    setShowEndGame(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-center py-12 text-sm" style={{ color: 'var(--loss)' }}>{error}</div>
  if (!state) return (
    <div className="text-center py-12">
      <div className="font-display text-xl mb-2" style={{ color: 'var(--navy)' }}>NO SCOREBOOK DATA</div>
      <Link to={`/${slug}/game/${gameId}/lineup`} className="text-sm font-bold no-underline" style={{ color: 'var(--gold-dark)' }}>Go to lineup setup</Link>
    </div>
  )

  const halfArrow = state.half === 'top' ? '▲' : '▼'
  const inningText = ORDINALS[state.inning] || `${state.inning}TH`
  const countDots = (n, max, activeColor) => Array.from({ length: max }, (_, i) => (
    <span key={i} className="inline-block w-2 h-2 rounded-full" style={{ background: i < n ? activeColor : 'rgba(255,255,255,0.15)' }} />
  ))

  return (
    <div className="-mx-4" style={{ background: '#1a1a2e', minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-full shadow-2xl text-sm font-bold text-white"
          style={{ background: 'var(--gold)', color: 'var(--navy)', boxShadow: '0 8px 32px rgba(212,168,50,0.4)' }}>
          {toast}
        </div>
      )}

      {/* ━━━ SCOREBOARD ━━━ */}
      <div style={{ background: 'linear-gradient(180deg, #1e2d3d 0%, #2B3E50 100%)' }}>
        <div className="flex items-stretch">
          {/* Away */}
          <div className="flex-1 py-3 px-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-0.5 truncate">{state.away_team_name}</div>
            <div className="font-display text-4xl text-white leading-none">{score.awayScore}</div>
          </div>
          {/* Center — inning + count */}
          <div className="flex flex-col items-center justify-center px-3 py-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="font-display text-sm tracking-widest" style={{ color: '#D4A832' }}>
              {halfArrow} {inningText}
            </div>
            <div className="flex gap-1.5 mt-1">
              {countDots(state.outs, 3, '#D4A832')}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex gap-0.5">{countDots(state.balls, 4, '#1B7340')}</div>
              <span className="text-white/20 text-[8px]">|</span>
              <div className="flex gap-0.5">{countDots(state.strikes, 3, '#B8302A')}</div>
            </div>
          </div>
          {/* Home */}
          <div className="flex-1 py-3 px-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-0.5 truncate">{state.home_team_name}</div>
            <div className="font-display text-4xl text-white leading-none">{score.homeScore}</div>
          </div>
        </div>
        <div className="stitch-line" style={{ opacity: 0.3 }} />
      </div>

      {/* ━━━ FIELD ━━━ */}
      <div style={{ background: 'radial-gradient(ellipse at 50% 80%, #2d6a25 0%, #1a4a15 60%, #1a1a2e 100%)' }} className="pt-1 pb-2">
        <GameDiamond
          runners={showRunners ? pendingRunners : { first: state.runner_1b, second: state.runner_2b, third: state.runner_3b }}
          batter={currentBatter}
          pitcher={currentPitcher}
          interactive={showRunners}
          onBaseClick={showRunners ? (base) => setPendingRunners(prev => ({ ...prev, [base]: prev[base] ? null : 'Runner' })) : undefined}
          dragMode={showInPlay && ipStep === 1}
          onBallDrop={(x, y) => { setIpHitLoc({ x, y }); setIpStep(2) }}
          hitMark={ipHitLoc}
          size={300}
        />
      </div>

      {/* ━━━ AT BAT STRIP ━━━ */}
      <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: 'rgba(43,62,80,0.95)', borderTop: '2px solid #D4A832' }}>
        {/* Batter avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #D4A832 0%, #B8912A 100%)', boxShadow: '0 2px 8px rgba(212,168,50,0.3)' }}>
          {currentBatter?.jersey_number || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg text-white leading-tight truncate">
            {currentBatter?.player_name || 'AT BAT'}
          </div>
          <div className="text-[10px] text-white/40 font-semibold tracking-wide">
            {currentBatter?.position || ''} {currentPitcher ? `vs ${currentPitcher.player_name?.split(' ').pop()}` : ''}
          </div>
        </div>
        {/* Pitch chips */}
        {pitchLog.length > 0 && (
          <div className="flex gap-0.5 flex-shrink-0">
            {pitchLog.slice(-8).map((p, i) => (
              <span key={i} className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ background: PITCH_CHIP[p]?.bg, color: PITCH_CHIP[p]?.color }}>
                {PITCH_CHIP[p]?.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ━━━ PITCH CONTROLS ━━━ */}
      {!showInPlay && !showRunners && !showEndGame && (
        <div className="px-3 py-3 space-y-2" style={{ background: '#1a1a2e' }}>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { t: 'B', label: 'BALL', bg: '#1B7340', c: '#fff' },
              { t: 'C', label: 'CALLED', bg: '#B8302A', c: '#fff' },
              { t: 'S', label: 'SWING', bg: '#B86A2A', c: '#fff' },
              { t: 'F', label: 'FOUL', bg: '#D4A832', c: '#2B3E50' },
            ].map(({ t, label, bg, c }) => (
              <button key={t}
                className="h-[52px] rounded-2xl font-display text-sm tracking-wider active:scale-93 transition-transform select-none pitch-btn"
                style={{ background: bg, color: c, boxShadow: `0 4px 12px ${bg}40` }}
                onClick={() => handlePitch(t)}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <button className="col-span-3 h-12 rounded-2xl font-display text-lg tracking-widest active:scale-95 transition-transform select-none pitch-btn"
              style={{ background: 'linear-gradient(135deg, #1B7340 0%, #27ae60 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(27,115,64,0.3)' }}
              onClick={handleInPlay}>
              IN PLAY
            </button>
            <button className="h-12 rounded-2xl font-display text-sm active:scale-95 transition-transform select-none pitch-btn"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--powder-light)' }}
              onClick={handleHBP}>HBP</button>
            <button className="h-12 rounded-2xl font-display text-sm active:scale-95 transition-transform select-none pitch-btn"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--powder-light)' }}
              onClick={handleUndo}
              disabled={pitchLog.length === 0}>
              UNDO
            </button>
          </div>
          <div className="flex justify-between items-center pt-1">
            <Link to={`/${slug}/game/${gameId}/live`} className="text-[10px] font-bold uppercase tracking-widest no-underline px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(212,168,50,0.15)', color: '#D4A832' }}>
              LIVE VIEW
            </Link>
            <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(184,48,42,0.15)', color: '#B8302A' }}
              onClick={() => setShowEndGame(true)}>
              END GAME
            </button>
          </div>
        </div>
      )}

      {/* ━━━ IN PLAY PANEL ━━━ */}
      {showInPlay && (
        <div className="px-4 py-4 space-y-3" style={{ background: '#1e2d3d', borderTop: '2px solid #D4A832' }}>
          <div className="flex items-center justify-between">
            <div className="font-display text-lg tracking-wider text-white">BALL IN PLAY</div>
            <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: 'rgba(184,48,42,0.2)', color: '#B8302A' }}
              onClick={() => { setShowInPlay(false); resetInPlay() }}>CANCEL</button>
          </div>

          {ipStep === 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">HIT TYPE</div>
              <div className="grid grid-cols-4 gap-1.5">
                {HIT_TYPES.map(ht => (
                  <button key={ht.code}
                    className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
                    onClick={() => { setIpHitType(ht.code); setIpStep(1) }}>
                    <span className="text-lg">{ht.icon}</span>
                    <span className="text-[10px] font-bold tracking-wider">{ht.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {ipStep === 1 && (
            <div className="text-center py-3">
              <div className="font-display text-base text-white mb-1">DRAG THE BALL</div>
              <div className="text-xs text-white/40">Drag the baseball on the field to where it was hit</div>
            </div>
          )}

          {ipStep === 2 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">FIELDED BY</div>
              <div className="grid grid-cols-3 gap-1.5">
                {FIELDERS.map(pos => (
                  <button key={pos}
                    className="h-12 rounded-xl font-display text-base tracking-wider active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={() => { setIpFielder(pos); setIpStep(3) }}>
                    {pos}
                  </button>
                ))}
              </div>
            </>
          )}

          {ipStep === 3 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">OUTS</div>
              <div className="grid grid-cols-3 gap-1.5">
                {RESULTS.outs.map(r => (
                  <button key={r.code}
                    className="h-10 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    style={{ background: 'rgba(184,48,42,0.2)', color: '#e74c3c', border: '1px solid rgba(184,48,42,0.3)' }}
                    onClick={() => handleInPlayResult(r.code)}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">SAFE</div>
              <div className="grid grid-cols-4 gap-1.5">
                {RESULTS.hits.map(r => (
                  <button key={r.code}
                    className="h-12 rounded-xl font-display text-xl tracking-wider active:scale-95 transition-transform"
                    style={{
                      background: r.code === 'HR' ? 'linear-gradient(135deg, #D4A832, #B8912A)' : 'rgba(255,255,255,0.1)',
                      color: r.code === 'HR' ? '#1a1a2e' : 'white',
                      boxShadow: r.code === 'HR' ? '0 4px 16px rgba(212,168,50,0.3)' : 'none',
                      border: r.code === 'HR' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    }}
                    onClick={() => handleInPlayResult(r.code)}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button className="w-full h-10 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: 'rgba(27,115,64,0.2)', color: '#27ae60', border: '1px solid rgba(27,115,64,0.3)' }}
                onClick={() => handleInPlayResult('E')}>
                Error
              </button>
            </>
          )}
        </div>
      )}

      {/* ━━━ RUNNERS PANEL ━━━ */}
      {showRunners && (
        <div className="px-4 py-4 space-y-3" style={{ background: '#1e2d3d', borderTop: '2px solid #D4A832' }}>
          <div className="flex items-center gap-3">
            <span className="font-display text-xl tracking-wider text-white">{pendingOutcome}</span>
            <span className="text-xs text-white/40">Tap bases to adjust runners</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-9 px-4 rounded-full text-xs font-bold active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
              onClick={() => setPendingRuns(r => Math.max(0, r - 1))}>-</button>
            <div className="font-display text-3xl text-white">
              {pendingRuns}
              <span className="text-sm text-white/40 ml-1">RUNS</span>
            </div>
            <button className="h-9 px-4 rounded-full text-xs font-bold active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
              onClick={() => setPendingRuns(r => r + 1)}>+</button>
          </div>
          <button className="w-full h-14 rounded-2xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #D4A832, #B8912A)', color: '#1a1a2e', boxShadow: '0 4px 20px rgba(212,168,50,0.3)' }}
            onClick={confirmRunners}>
            CONFIRM
          </button>
        </div>
      )}

      {/* ━━━ END GAME ━━━ */}
      {showEndGame && (
        <div className="px-4 py-4 space-y-3" style={{ background: '#1e2d3d', borderTop: '2px solid #B8302A' }}>
          <div className="font-display text-xl tracking-wider" style={{ color: '#e74c3c' }}>END GAME?</div>
          <div className="text-xs text-white/50">Final score will be calculated from play data.</div>
          <button className="w-full h-14 rounded-2xl font-display text-xl tracking-widest text-white active:scale-95"
            style={{ background: '#B8302A', boxShadow: '0 4px 16px rgba(184,48,42,0.3)' }}
            onClick={handleEndGame}>FINAL</button>
          <button className="w-full h-10 rounded-xl text-sm font-semibold text-white/50"
            onClick={() => setShowEndGame(false)}>Cancel</button>
        </div>
      )}

      {/* ━━━ PLAY LOG ━━━ */}
      {playLog.length > 0 && (
        <div className="px-4 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">RECENT PLAYS</div>
          {playLog.slice(0, 4).map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5"
              style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: 1 - i * 0.15 }}>
              <span className="text-xs font-semibold text-white/70 truncate flex-1">{p.batter}</span>
              <span className="font-display text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: isOut(p.outcome) ? 'rgba(184,48,42,0.2)' : ['1B','2B','3B','HR'].includes(p.outcome) ? 'rgba(212,168,50,0.2)' : 'rgba(27,115,64,0.2)',
                  color: isOut(p.outcome) ? '#e74c3c' : ['1B','2B','3B','HR'].includes(p.outcome) ? '#D4A832' : '#27ae60',
                }}>
                {p.outcome}
              </span>
              {p.fielder && <span className="text-[10px] font-bold text-white/30">{p.fielder}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
