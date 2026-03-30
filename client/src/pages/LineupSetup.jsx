import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGame, getTeamBySlug, initScorebookGame, saveLineup, startScorebookGame } from '../api'
import LoadingSpinner from '../components/LoadingSpinner'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'EH']

function PinModal({ onSuccess }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRefs = [useRef(), useRef(), useRef(), useRef()]

  const filled = digits.filter(Boolean).length

  function pressDigit(d) {
    const idx = digits.findIndex(v => !v)
    if (idx === -1) return
    const next = [...digits]
    next[idx] = d
    setDigits(next)
    if (idx < 3) inputRefs[idx + 1]?.current?.focus()
    if (idx === 3) {
      // auto-submit when last digit filled
      submitPin([...digits.slice(0, 3), d])
    }
  }

  function backspace() {
    const idx = [...digits].reverse().findIndex(v => v)
    if (idx === -1) return
    const realIdx = 3 - idx
    const next = [...digits]
    next[realIdx] = ''
    setDigits(next)
  }

  async function submitPin(pin = digits) {
    const pinStr = pin.join('')
    if (pinStr.length < 4) return
    setLoading(true)
    setError('')
    try {
      await onSuccess(pinStr)
    } catch (e) {
      setError(e.message || 'Invalid PIN')
      setShake(true)
      setDigits(['', '', '', ''])
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(43,62,80,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className={`card w-full max-w-sm p-6 rounded-2xl ${shake ? 'animate-shake' : ''}`}
        style={{ animationDuration: '0.4s' }}>
        <div className="text-center mb-6">
          <div className="font-display text-2xl mb-1" style={{ color: 'var(--navy)' }}>SCOREKEEPER ACCESS</div>
          <div className="text-sm" style={{ color: 'var(--navy-muted)' }}>Enter your PIN to score this game</div>
        </div>

        {/* Digit display */}
        <div className="flex justify-center gap-3 mb-6">
          {digits.map((d, i) => (
            <div key={i} className="w-14 h-16 rounded-xl flex items-center justify-center font-display text-3xl transition-all"
              style={{
                border: `2px solid ${d ? 'var(--gold)' : 'var(--border)'}`,
                background: d ? 'var(--sky)' : 'var(--cream)',
                color: 'var(--navy)',
              }}>
              {d ? '●' : ''}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-center mb-4 text-sm font-semibold" style={{ color: 'var(--loss)' }}>{error}</div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d}
              className="h-14 rounded-xl font-display text-2xl active:scale-95 transition-transform select-none"
              style={{ background: 'var(--sky)', color: 'var(--navy)' }}
              onClick={() => pressDigit(d)}>
              {d}
            </button>
          ))}
          <div />
          <button className="h-14 rounded-xl font-display text-2xl active:scale-95 transition-transform select-none"
            style={{ background: 'var(--sky)', color: 'var(--navy)' }}
            onClick={() => pressDigit('0')}>0</button>
          <button className="h-14 rounded-xl font-display text-2xl active:scale-95 transition-transform select-none"
            style={{ background: 'var(--sky)', color: 'var(--loss)' }}
            onClick={backspace}>⌫</button>
        </div>

        {loading && (
          <div className="mt-4 text-center text-sm" style={{ color: 'var(--navy-muted)' }}>Verifying...</div>
        )}

        {filled === 4 && !loading && (
          <button className="mt-4 w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
            style={{ background: 'var(--navy)' }}
            onClick={() => submitPin()}>
            CONTINUE
          </button>
        )}
      </div>
    </div>
  )
}

export default function LineupSetup() {
  const { gameId, slug } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState(null)
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState(() => sessionStorage.getItem('scorekeeper_pin') || '')
  const [showPin, setShowPin] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [ourSide, setOurSide] = useState('home')
  const [saving, setSaving] = useState(false)

  // Lineup state: 9 rows each side
  const [homeLineup, setHomeLineup] = useState(
    Array.from({ length: 9 }, (_, i) => ({ playerName: '', jerseyNumber: '', position: '' }))
  )
  const [awayLineup, setAwayLineup] = useState(
    Array.from({ length: 9 }, (_, i) => ({ playerName: '', jerseyNumber: '', position: '' }))
  )
  const [rosterSuggestions, setRosterSuggestions] = useState([])
  const [suggestingIdx, setSuggestingIdx] = useState(null)

  useEffect(() => {
    Promise.all([
      getGame(gameId).catch(() => null),
      getTeamBySlug(slug).catch(() => null),
    ]).then(([g, t]) => {
      setGame(g)
      setTeam(t)
      setLoading(false)
    })
  }, [gameId, slug])

  // Show PIN modal if no pin stored
  useEffect(() => {
    if (!loading && !pin) setShowPin(true)
  }, [loading, pin])

  async function handlePinSuccess(enteredPin) {
    // Validate by calling init (server checks PIN)
    const opponentName = game?.opponent_name || 'Opponent'
    const homeTeamName = ourSide === 'home' ? (team?.name || 'Home') : opponentName
    const awayTeamName = ourSide === 'away' ? (team?.name || 'Away') : opponentName
    await initScorebookGame(parseInt(gameId), { homeTeamName, awayTeamName, ourSide }, enteredPin)
    sessionStorage.setItem('scorekeeper_pin', enteredPin)
    setPin(enteredPin)
    setShowPin(false)
  }

  function updateEntry(side, idx, field, value) {
    const setter = side === 'home' ? setHomeLineup : setAwayLineup
    setter(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function handleNameFocus(side, idx) {
    if (side !== (ourSide === 'home' ? 'home' : 'away')) return
    // Show roster suggestions for our team's side
    const players = team?.players || []
    setRosterSuggestions(players)
    setSuggestingIdx(`${side}-${idx}`)
  }

  function pickSuggestion(side, idx, player) {
    updateEntry(side, idx, 'playerName', player.name)
    updateEntry(side, idx, 'jerseyNumber', player.number || '')
    updateEntry(side, idx, 'position', player.position || '')
    setSuggestingIdx(null)
  }

  async function handleSaveAndStart() {
    if (!pin) { setShowPin(true); return }
    setSaving(true)
    try {
      const opponentName = game?.opponent_name || 'Opponent'
      const homeTeamName = ourSide === 'home' ? (team?.name || 'Home') : opponentName
      const awayTeamName = ourSide === 'away' ? (team?.name || 'Away') : opponentName

      // Re-init in case ourSide changed
      await initScorebookGame(parseInt(gameId), { homeTeamName, awayTeamName, ourSide }, pin)

      // Save both lineups
      const homeEntries = homeLineup.map((e, i) => ({ battingOrder: i + 1, ...e }))
      const awayEntries = awayLineup.map((e, i) => ({ battingOrder: i + 1, ...e }))
      await saveLineup(parseInt(gameId), { teamSide: 'home', entries: homeEntries }, pin)
      await saveLineup(parseInt(gameId), { teamSide: 'away', entries: awayEntries }, pin)
      await startScorebookGame(parseInt(gameId), pin)

      navigate(`../game/${gameId}/score`, { relative: 'path' })
    } catch (e) {
      if (e.message?.includes('PIN') || e.message?.includes('401')) {
        sessionStorage.removeItem('scorekeeper_pin')
        setPin('')
        setShowPin(true)
      } else {
        alert(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const ourLineup = ourSide === 'home' ? homeLineup : awayLineup
  const themLineup = ourSide === 'home' ? awayLineup : homeLineup
  const ourSetter = ourSide === 'home' ? setHomeLineup : setAwayLineup
  const themSetter = ourSide === 'home' ? setAwayLineup : setHomeLineup

  const hasEnough = ourLineup.some(e => e.playerName) && themLineup.some(e => e.playerName)

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 pb-8" onClick={() => setSuggestingIdx(null)}>
      {showPin && <PinModal onSuccess={handlePinSuccess} />}

      {/* Header */}
      <div>
        <div className="font-display text-2xl" style={{ color: 'var(--navy)' }}>LINEUP SETUP</div>
        {game && (
          <div className="text-sm mt-0.5" style={{ color: 'var(--navy-muted)' }}>
            vs {game.opponent_name || 'Opponent'}
            {game.game_date && ` · ${formatDate(game.game_date)}`}
            {game.game_time && ` · ${game.game_time}`}
          </div>
        )}
      </div>

      {/* HOME / AWAY toggle */}
      <div className="card px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--navy-muted)' }}>
          WE ARE
        </div>
        <div className="flex rounded-xl overflow-hidden border-2 p-0.5 gap-0.5"
          style={{ borderColor: 'var(--border)', background: 'var(--sky)' }}>
          {['home', 'away'].map(side => (
            <button key={side}
              className="flex-1 py-2.5 rounded-lg font-display text-lg tracking-wider transition-all active:scale-97"
              style={{
                background: ourSide === side ? 'var(--navy)' : 'transparent',
                color: ourSide === side ? 'white' : 'var(--navy-muted)',
              }}
              onClick={() => setOurSide(side)}>
              {side.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b-2" style={{ borderColor: 'var(--border)' }}>
          {['our', 'opp'].map(tab => {
            const isOur = tab === 'our'
            const isActive = activeTab === tab
            const label = isOur ? (team?.name?.toUpperCase() || 'OUR TEAM') : (game?.opponent_name?.toUpperCase() || 'OPPONENT')
            return (
              <button key={tab}
                className="flex-1 py-3 font-display text-lg tracking-wider relative transition-colors"
                style={{ color: isActive ? 'var(--navy)' : 'var(--navy-muted)' }}
                onClick={() => setActiveTab(tab)}>
                <span className="truncate block px-2">{label}</span>
                {isActive && (
                  <div className="absolute bottom-0 inset-x-4 h-[3px] rounded-full"
                    style={{ background: 'var(--gold)' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Lineup rows */}
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="w-6" />
            <span className="flex-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--navy-muted)' }}>PLAYER</span>
            <span className="w-14 text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--navy-muted)' }}>POS</span>
          </div>

          {(activeTab === 'our' ? ourLineup : themLineup).map((entry, idx) => {
            const side = activeTab === 'our' ? (ourSide === 'home' ? 'home' : 'away') : (ourSide === 'home' ? 'away' : 'home')
            const setter = activeTab === 'our' ? ourSetter : themSetter
            const key = `${side}-${idx}`
            const filled = !!entry.playerName

            return (
              <div key={idx} className="relative">
                <div className="flex items-center gap-2 py-2 px-2 rounded-xl transition-colors"
                  style={{
                    borderLeft: `3px solid ${filled ? 'var(--gold)' : 'var(--border)'}`,
                    background: filled ? 'rgba(212,168,50,0.06)' : 'var(--cream)',
                  }}>
                  <span className="font-display text-lg w-6 text-center flex-shrink-0"
                    style={{ color: 'var(--navy-muted)' }}>{idx + 1}</span>
                  <input
                    className="flex-1 h-11 px-3 rounded-lg border text-sm font-medium focus:outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
                    placeholder="Player name..."
                    value={entry.playerName}
                    onChange={e => {
                      setter(prev => {
                        const next = [...prev]
                        next[idx] = { ...next[idx], playerName: e.target.value }
                        return next
                      })
                    }}
                    onFocus={e => {
                      e.stopPropagation()
                      if (activeTab === 'our') {
                        setRosterSuggestions(team?.players || [])
                        setSuggestingIdx(key)
                      }
                    }}
                  />
                  <select
                    className="h-11 w-16 rounded-lg border text-sm font-bold text-center appearance-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
                    value={entry.position}
                    onChange={e => {
                      setter(prev => {
                        const next = [...prev]
                        next[idx] = { ...next[idx], position: e.target.value }
                        return next
                      })
                    }}>
                    <option value="">—</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Roster autocomplete dropdown */}
                {suggestingIdx === key && rosterSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 card shadow-lg overflow-hidden"
                    style={{ top: '100%', maxHeight: '200px', overflowY: 'auto' }}
                    onClick={e => e.stopPropagation()}>
                    {rosterSuggestions
                      .filter(p => !entry.playerName || p.name.toLowerCase().includes(entry.playerName.toLowerCase()))
                      .slice(0, 8)
                      .map(player => (
                        <button key={player.id}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left border-b hover:bg-[var(--sky)] transition-colors"
                          style={{ borderColor: 'var(--border)' }}
                          onMouseDown={e => {
                            e.preventDefault()
                            pickSuggestion(side, idx, player)
                          }}>
                          <span className="w-7 h-7 rounded-full flex items-center justify-center font-display text-sm text-white flex-shrink-0"
                            style={{ background: 'var(--navy)' }}>
                            {player.name.charAt(0)}
                          </span>
                          <span className="flex-1 text-sm font-medium" style={{ color: 'var(--navy)' }}>{player.name}</span>
                          {player.number && <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>#{player.number}</span>}
                          {player.position && <span className="text-xs font-bold" style={{ color: 'var(--powder)' }}>{player.position}</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Save & Start */}
      <button
        className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white transition-opacity active:scale-95"
        style={{ background: hasEnough ? 'var(--navy)' : 'var(--navy-muted)', opacity: hasEnough ? 1 : 0.5 }}
        disabled={!hasEnough || saving}
        onClick={handleSaveAndStart}>
        {saving ? 'STARTING...' : 'SAVE & START GAME'}
      </button>

      <p className="text-center text-xs" style={{ color: 'var(--navy-muted)' }}>
        You can skip positions and add players during the game.
      </p>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
