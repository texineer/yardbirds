import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getScorebookState, updateScorebookState,
  logPitch, undoLastPitch, startPlateAppearance, recordPlateAppearanceOutcome,
  updateInningScore, endScorebookGame, recordSubstitution,
} from '../api'
import { useAuth } from '../context/AuthContext'
import BasesDiamond from '../components/BasesDiamond'
import LoadingSpinner from '../components/LoadingSpinner'

const OUTCOMES_CONFIG = [
  { code: 'K',   label: 'K',    group: 'out',  display: 'K' },
  { code: 'Kl',  label: 'K👁',  group: 'out',  display: 'K👁' },
  { code: 'BB',  label: 'BB',   group: 'on',   display: 'BB' },
  { code: 'HBP', label: 'HBP',  group: 'on',   display: 'HBP' },
  { code: '1B',  label: '1B',   group: 'hit',  display: '1B' },
  { code: '2B',  label: '2B',   group: 'hit',  display: '2B' },
  { code: '3B',  label: '3B',   group: 'hit',  display: '3B' },
  { code: 'HR',  label: 'HR',   group: 'hr',   display: 'HR' },
  { code: 'GO',  label: 'GO',   group: 'misc', display: 'GO' },
  { code: 'FO',  label: 'FO',   group: 'misc', display: 'FO' },
  { code: 'LO',  label: 'LO',   group: 'misc', display: 'LO' },
  { code: 'SAC', label: 'SAC',  group: 'misc', display: 'SAC' },
  { code: 'DP',  label: 'DP',   group: 'misc', display: 'DP' },
  { code: 'FC',  label: 'FC',   group: 'misc', display: 'FC' },
  { code: 'E',   label: 'E',    group: 'misc', display: 'E' },
]

const OUTCOME_GROUP_STYLES = {
  out:  { background: 'var(--loss-bg, #fdecea)',  color: 'var(--loss)' },
  on:   { background: 'var(--win-bg, #eaf5ee)',   color: 'var(--win)' },
  hit:  { background: 'rgba(138,175,198,0.2)',    color: 'var(--navy)' },
  hr:   { background: 'var(--gold)',              color: 'var(--navy)' },
  misc: { background: 'var(--sky)',               color: 'var(--navy)' },
}

const PITCH_CHIP_STYLES = {
  B: { background: 'var(--win-bg, #eaf5ee)',   color: 'var(--win)',     label: 'B' },
  C: { background: 'var(--loss-bg, #fdecea)',  color: 'var(--loss)',    label: 'C' },
  F: { background: 'rgba(212,168,50,0.15)',    color: 'var(--gold-dark, #b8891e)', label: 'F' },
  S: { background: 'rgba(184,106,42,0.15)',    color: '#B86A2A',        label: 'S' },
}

const ORDINALS = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH', '11TH', '12TH']

function OutsDots({ count, large }) {
  return (
    <div className="flex gap-1.5 items-center">
      {[0, 1, 2].map(i => (
        <span key={i}
          className={`inline-block rounded-full border-2 ${large ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`}
          style={{
            background: i < count ? 'var(--gold)' : 'transparent',
            borderColor: i < count ? 'var(--gold-dark, #b8891e)' : 'var(--border)',
          }} />
      ))}
    </div>
  )
}

function RHESheet({ inning, half, onConfirm, onCancel }) {
  const [runs, setRuns] = useState(0)
  const [hits, setHits] = useState(0)
  const [errors, setErrors] = useState(0)

  function Stepper({ label, value, onChange }) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--navy-muted)' }}>{label}</span>
        <button className="w-14 h-11 rounded-t-xl font-bold text-xl active:bg-gray-100 transition-colors"
          style={{ background: 'var(--sky)', color: 'var(--navy)' }}
          onClick={() => onChange(v => Math.min(v + 1, 99))}>+</button>
        <div className="w-14 h-12 font-display text-4xl flex items-center justify-center"
          style={{ background: 'var(--cream)', color: 'var(--navy)', border: '1px solid var(--border)' }}>
          {value}
        </div>
        <button className="w-14 h-11 rounded-b-xl font-bold text-xl active:bg-gray-100 transition-colors"
          style={{ background: 'var(--sky)', color: 'var(--navy)' }}
          onClick={() => onChange(v => Math.max(v - 1, 0))}>−</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(43,62,80,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="card w-full max-w-sm rounded-t-2xl p-6 sheet-enter">
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
        <div className="font-display text-xl mb-1" style={{ color: 'var(--navy)' }}>END OF INNING</div>
        <div className="text-sm mb-5" style={{ color: 'var(--navy-muted)' }}>
          {half === 'top' ? '▲' : '▼'} {ORDINALS[inning] || `${inning}TH`} — Confirm runs scored
        </div>
        <div className="flex justify-around mb-6">
          <Stepper label="RUNS"   value={runs}   onChange={setRuns} />
          <Stepper label="HITS"   value={hits}   onChange={setHits} />
          <Stepper label="ERRORS" value={errors} onChange={setErrors} />
        </div>
        <button className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform mb-2"
          style={{ background: 'var(--navy)' }}
          onClick={() => onConfirm(runs, hits, errors)}>
          CONFIRM & NEXT INNING
        </button>
        <button className="w-full h-10 rounded-xl text-sm font-semibold"
          style={{ color: 'var(--navy-muted)' }}
          onClick={onCancel}>
          Cancel
        </button>
      </div>
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
          Mark this game as final. The score will be saved from inning totals.
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

export default function Scorebook() {
  const { gameId, slug } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [state, setState] = useState(null)
  const [homeLineup, setHomeLineup] = useState([])
  const [awayLineup, setAwayLineup] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Current at-bat tracking
  const [currentPaId, setCurrentPaId] = useState(null)
  const [pitchLog, setPitchLog] = useState([])    // pitch types for current PA
  const [showRunners, setShowRunners] = useState(false)
  const [showRHE, setShowRHE] = useState(false)
  const [showEndGame, setShowEndGame] = useState(false)

  // Toast
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const [subState, setSubState] = useState(null) // { side, idx } or null

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
      showToast('Sync error — check connection')
    }
  }

  const currentBatterSide = state?.half === 'top' ? 'away' : 'home'
  const currentBatterLineup = currentBatterSide === 'home' ? homeLineup : awayLineup
  const currentPitcherSide = currentBatterSide === 'home' ? 'away' : 'home'
  const currentPitcherLineup = currentPitcherSide === 'home' ? homeLineup : awayLineup

  // Get current pitcher from lineup (P position or first entry)
  const currentPitcher = currentPitcherLineup.find(e => e.position === 'P' && e.active) || currentPitcherLineup[0]
  const currentBatterIdx = 0 // simplified: always first active batter for display
  const currentBatter = currentBatterLineup[0]

  async function handlePitch(type) {
    if (!state) return
    const newLog = [...pitchLog, type]
    setPitchLog(newLog)

    // Update count optimistically
    let { balls, strikes } = state
    if (type === 'B') balls = Math.min(balls + 1, 3)
    else if (type === 'S' || type === 'C') strikes = Math.min(strikes + 1, 2)
    setState(s => ({ ...s, balls, strikes }))

    // Log to server (fire and forget with error toast)
    const paId = currentPaId
    logPitch(parseInt(gameId), {
      paId,
      pitcherName: currentPitcher?.player_name || 'Unknown',
      pitcherTeamSide: currentPitcherSide,
      pitchType: type,
      inning: state.inning,
      half: state.half,
    }).catch(() => showToast('Sync error'))
  }

  async function handleUndo() {
    if (pitchLog.length === 0) return
    const newLog = pitchLog.slice(0, -1)
    setPitchLog(newLog)

    // Recalculate count from remaining log
    let balls = 0, strikes = 0
    for (const t of newLog) {
      if (t === 'B') balls = Math.min(balls + 1, 3)
      else if (t === 'S' || t === 'C') strikes = Math.min(strikes + 1, 2)
    }
    setState(s => ({ ...s, balls, strikes }))

    try {
      await undoLastPitch(parseInt(gameId))
      showToast('Last pitch undone')
    } catch {
      showToast('Sync error')
    }
  }

  async function handleOutcome(code) {
    if (!state) return

    // Record plate appearance outcome
    if (currentPaId) {
      await recordPlateAppearanceOutcome(parseInt(gameId), currentPaId, {
        outcome: code,
        rbi: 0,
        pitchSequence: pitchLog.join(','),
      }).catch(() => {})
    }

    const isOut = ['K', 'Kl', 'GO', 'FO', 'LO', 'DP'].includes(code)
    const newOuts = isOut ? state.outs + 1 : state.outs

    if (newOuts >= 3) {
      // Show R/H/E panel
      setShowRHE(true)
      setState(s => ({ ...s, outs: newOuts, balls: 0, strikes: 0 }))
    } else {
      // Show runner placement for hits/on base
      const isHitOrOn = ['1B', '2B', '3B', 'HR', 'BB', 'HBP'].includes(code)
      if (isHitOrOn) {
        setShowRunners(true)
      }
      await syncState({ outs: newOuts, balls: 0, strikes: 0 })
    }

    setPitchLog([])

    // Start next PA
    startNextPA()
  }

  async function startNextPA() {
    try {
      const batter = currentBatter
      const pitcher = currentPitcher
      const result = await startPlateAppearance(parseInt(gameId), {
        inning: state.inning,
        half: state.half,
        battingOrderPos: 1,
        teamSide: currentBatterSide,
        playerName: batter?.player_name || 'Unknown',
        pitcherName: pitcher?.player_name || 'Unknown',
      })
      setCurrentPaId(result.paId)
    } catch {
      showToast('Sync error starting PA')
    }
  }

  async function handleRHEConfirm(runs, hits, errors) {
    await updateInningScore(parseInt(gameId), state.inning, state.half, { runs, hits, errors }).catch(() => {})

    // Advance to next half/inning
    let newInning = state.inning
    let newHalf = state.half

    if (newHalf === 'top') {
      newHalf = 'bottom'
    } else {
      newHalf = 'top'
      newInning += 1
    }

    setShowRHE(false)
    await syncState({ inning: newInning, half: newHalf, outs: 0, balls: 0, strikes: 0, runner_1b: null, runner_2b: null, runner_3b: null })
    startNextPA()
  }

  async function handleEndGame() {
    // Server computes final score from stored inning_scores
    try {
      await endScorebookGame(parseInt(gameId), {})
      navigate(`/${slug}/game/${gameId}`)
    } catch (e) {
      showToast(e.message || 'Error ending game')
    }
    setShowEndGame(false)
  }

  async function handleToggleRunner(base) {
    const key = { first: 'runner_1b', second: 'runner_2b', third: 'runner_3b' }[base]
    const current = state[key]
    const newVal = current ? null : (currentBatter?.player_name || 'Runner')
    await syncState({ [key]: newVal })
  }

  // Compute score from state (simplified: use a tallied approach)

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-center py-12 text-sm" style={{ color: 'var(--loss)' }}>{error}</div>
  if (!state) return null

  const halfLabel = state.half === 'top' ? '▲' : '▼'
  const inningLabel = `${halfLabel} ${ORDINALS[state.inning] || `${state.inning}TH`}`
  const ourTeamName = state.our_side === 'home' ? state.home_team_name : state.away_team_name
  const oppTeamName = state.our_side === 'home' ? state.away_team_name : state.home_team_name

  return (
    <div className="space-y-3 pb-24">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold text-white"
          style={{ background: 'var(--navy)', maxWidth: '280px' }}>
          {toast}
        </div>
      )}

      {showRHE && (
        <RHESheet
          inning={state.inning}
          half={state.half}
          onConfirm={handleRHEConfirm}
          onCancel={() => setShowRHE(false)}
        />
      )}

      {showEndGame && (
        <EndGameConfirm
          onConfirm={handleEndGame}
          onCancel={() => setShowEndGame(false)}
        />
      )}

      {/* Sticky game state bar */}
      <div className="sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between border-b -mx-4"
        style={{ background: 'var(--sky)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-display text-lg" style={{ color: 'var(--gold)' }}>{halfLabel}</span>
          <span className="font-display text-xl tracking-wider" style={{ color: 'var(--navy)' }}>{inningLabel}</span>
        </div>
        <OutsDots count={state.outs} large />
        <div className="flex items-center gap-2">
          <span className="font-display text-base tracking-wider" style={{ color: 'var(--navy)' }}>
            {ourTeamName?.slice(0, 4) || 'US'} – {oppTeamName?.slice(0, 4) || 'THEM'}
          </span>
          <Link to={`/${slug}/game/${gameId}/live`}
            className="text-[10px] font-bold px-2 py-1 rounded no-underline"
            style={{ background: 'rgba(43,62,80,0.1)', color: 'var(--navy)' }}>
            LIVE ↗
          </Link>
        </div>
      </div>

      {/* Current AT BAT card */}
      <div className="card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
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
            P: {currentPitcher?.player_name || '—'}
          </div>
        </div>

        {/* Count */}
        <div className="flex items-baseline justify-center gap-4 py-1">
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--navy-muted)' }}>BALLS</div>
            <div className="font-display leading-none" style={{ fontSize: '3rem', color: 'var(--win)' }}>{state.balls}</div>
          </div>
          <div className="font-display text-2xl opacity-20" style={{ color: 'var(--navy)' }}>–</div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--navy-muted)' }}>STRIKES</div>
            <div className="font-display leading-none" style={{ fontSize: '3rem', color: 'var(--loss)' }}>{state.strikes}</div>
          </div>
        </div>

        {/* Pitch log chips */}
        {pitchLog.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1">
            {pitchLog.map((p, i) => (
              <span key={i}
                className="h-7 px-2.5 rounded-md font-display text-sm flex-shrink-0 flex items-center"
                style={{ background: PITCH_CHIP_STYLES[p]?.background, color: PITCH_CHIP_STYLES[p]?.color }}>
                {PITCH_CHIP_STYLES[p]?.label || p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* PITCH BUTTONS */}
      <div>
        <div className="section-label mb-2">PITCH</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: 'B', primary: 'BALL',          bg: 'var(--navy)',               text: 'white' },
            { type: 'F', primary: 'FOUL',           bg: 'var(--gold-dark, #b8891e)', text: 'var(--navy)' },
            { type: 'S', primary: 'STRIKE',         sub: 'swinging', bg: '#B86A2A',  text: 'white' },
            { type: 'C', primary: 'STRIKE',         sub: 'called',   bg: 'var(--loss)', text: 'white' },
          ].map(({ type, primary, sub, bg, text }) => (
            <button key={type}
              className="h-20 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform select-none pitch-btn"
              style={{ background: bg, color: text }}
              onClick={() => handlePitch(type)}>
              <span className="font-display leading-none" style={{ fontSize: '2.5rem' }}>{type}</span>
              <span className="text-[11px] font-bold tracking-wider opacity-85">{primary}</span>
              {sub && <span className="text-[9px] opacity-60">{sub}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* UNDO */}
      <button
        className="w-full h-11 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
        style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}
        onClick={handleUndo}>
        ← UNDO LAST PITCH
      </button>

      {/* OUTCOME BUTTONS */}
      <div>
        <div className="section-label mb-2">OUTCOME</div>
        <div className="grid grid-cols-4 gap-1.5">
          {OUTCOMES_CONFIG.map(({ code, display, group }) => (
            <button key={code}
              className="h-14 rounded-xl font-display text-base tracking-wide active:scale-95 transition-transform select-none"
              style={OUTCOME_GROUP_STYLES[group]}
              onClick={() => handleOutcome(code)}>
              {display}
            </button>
          ))}
        </div>
      </div>

      {/* RUNNER PLACEMENT */}
      {showRunners && (
        <div className="card p-4">
          <div className="section-label mb-3">PLACE RUNNERS</div>
          <div className="flex justify-center mb-3">
            <BasesDiamond
              runners={{
                first: !!state.runner_1b,
                second: !!state.runner_2b,
                third: !!state.runner_3b,
              }}
              interactive={true}
              onToggle={handleToggleRunner}
              size={140}
            />
          </div>
          <button
            className="w-full h-12 rounded-xl font-display text-lg tracking-widest text-white active:scale-95 transition-transform"
            style={{ background: 'var(--navy)' }}
            onClick={() => setShowRunners(false)}>
            CONFIRM
          </button>
        </div>
      )}

      {/* LINEUP LIST */}
      <div>
        <div className="section-label mb-2">
          {currentBatterSide === (state.our_side === 'home' ? 'home' : 'away') ? 'OUR LINEUP' : 'THEIR LINEUP'}
        </div>
        <div className="card overflow-hidden">
          {currentBatterLineup.filter(e => e.active !== 0).map((entry, idx) => {
            const isCurrent = idx === 0
            return (
              <div key={entry.id || idx} className="border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 px-3 py-2.5"
                  style={{
                    background: isCurrent ? 'rgba(212,168,50,0.08)' : undefined,
                    borderLeft: isCurrent ? '3px solid var(--gold)' : '3px solid transparent',
                  }}>
                  {isCurrent && <span className="font-display text-lg" style={{ color: 'var(--gold)' }}>▶</span>}
                  <span className="font-display text-base w-6 text-center flex-shrink-0"
                    style={{ color: 'var(--navy-muted)' }}>{entry.batting_order}</span>
                  {entry.jersey_number && (
                    <span className="text-xs font-bold" style={{ color: 'var(--gold-dark, #b8891e)' }}>#{entry.jersey_number}</span>
                  )}
                  <span className="flex-1 font-semibold text-sm truncate" style={{ color: 'var(--navy)' }}>
                    {entry.player_name}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--navy-muted)' }}>{entry.position}</span>
                  <button
                    className="text-[10px] font-bold px-2 py-1 rounded"
                    style={{ color: 'var(--powder)', background: 'var(--sky)' }}
                    onClick={() => setSubState({ side: currentBatterSide, idx, entry })}>
                    SUB
                  </button>
                </div>
                {subState?.idx === idx && subState?.side === currentBatterSide && (
                  <SubForm
                    onSave={async (name, number, pos) => {
                      await recordSubstitution(parseInt(gameId), {
                        teamSide: currentBatterSide,
                        battingOrder: entry.batting_order,
                        newPlayerName: name,
                        jerseyNumber: number,
                        position: pos,
                      }).catch(() => showToast('Sync error'))
                      // Refresh lineups
                      const data = await getScorebookState(gameId)
                      if (data) {
                        setHomeLineup(data.homeLineup || [])
                        setAwayLineup(data.awayLineup || [])
                      }
                      setSubState(null)
                    }}
                    onCancel={() => setSubState(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* END GAME */}
      <button
        className="w-full h-12 rounded-xl font-display text-lg tracking-widest text-white active:scale-95 transition-transform mt-4"
        style={{ background: 'var(--loss)' }}
        onClick={() => setShowEndGame(true)}>
        END GAME
      </button>
    </div>
  )
}

function SubForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [pos, setPos] = useState('')
  const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

  return (
    <div className="px-4 py-3 space-y-2" style={{ background: 'rgba(212,168,50,0.05)', borderTop: '1px solid var(--border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--navy-muted)' }}>SUBSTITUTE PLAYER</div>
      <div className="flex gap-2">
        <input
          className="flex-1 h-10 px-3 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--navy)' }}
          placeholder="New player name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="w-16 h-10 px-3 rounded-lg border text-sm text-center"
          style={{ borderColor: 'var(--border)', color: 'var(--navy)' }}
          placeholder="#"
          value={number}
          onChange={e => setNumber(e.target.value)}
        />
        <select
          className="w-16 h-10 rounded-lg border text-sm text-center appearance-none"
          style={{ borderColor: 'var(--border)', color: 'var(--navy)' }}
          value={pos}
          onChange={e => setPos(e.target.value)}>
          <option value="">—</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          className="flex-1 h-10 rounded-lg font-display text-sm tracking-wider text-white active:scale-95"
          style={{ background: 'var(--navy)' }}
          disabled={!name}
          onClick={() => onSave(name, number, pos)}>
          CONFIRM SUB
        </button>
        <button
          className="h-10 px-4 rounded-lg text-sm font-semibold"
          style={{ color: 'var(--navy-muted)', background: 'var(--sky)' }}
          onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

