import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getGame, getTeamBySlug, getTeams, initScorebookGame, saveLineup, startScorebookGame } from '../api'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'EH']

export default function LineupSetup() {
  const { gameId, slug } = useParams()
  const navigate = useNavigate()
  const { user, hasTeamRole, loading: authLoading } = useAuth()
  const [game, setGame] = useState(null)
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('our')
  const [ourSide, setOurSide] = useState('home')
  const [saving, setSaving] = useState(false)
  const [opponentTeam, setOpponentTeam] = useState(null)

  // Lineup state: 9 slots each side
  const [homeLineup, setHomeLineup] = useState(
    Array.from({ length: 9 }, () => ({ playerName: '', jerseyNumber: '', position: '' }))
  )
  const [awayLineup, setAwayLineup] = useState(
    Array.from({ length: 9 }, () => ({ playerName: '', jerseyNumber: '', position: '' }))
  )

  useEffect(() => {
    Promise.all([
      getGame(gameId).catch(() => null),
      getTeamBySlug(slug).catch(() => null),
      getTeams().catch(() => []),
    ]).then(([g, t, allTeams]) => {
      setGame(g)
      setTeam(t)
      if (g?.opponent_name && allTeams.length) {
        const oppTeam = allTeams.find(at => at.name === g.opponent_name)
        if (oppTeam?.slug) {
          getTeamBySlug(oppTeam.slug).then(setOpponentTeam).catch(() => {})
        }
      }
      setLoading(false)
    })
  }, [gameId, slug])

  const canScore = !authLoading && user && team && hasTeamRole(team.pg_org_id, team.pg_team_id, ['admin', 'scorekeeper'])

  if (loading || authLoading) return <LoadingSpinner />

  if (!user) {
    return (
      <div className="text-center py-12">
        <div className="font-display text-2xl mb-2" style={{ color: 'var(--navy)' }}>SIGN IN REQUIRED</div>
        <p className="text-sm mb-4" style={{ color: 'var(--navy-muted)' }}>
          You need to be signed in as a scorekeeper to score this game.
        </p>
        <Link to="/login" className="inline-block font-display text-lg tracking-wider px-6 py-3 rounded-xl text-white no-underline"
          style={{ background: 'var(--navy)' }}>
          SIGN IN
        </Link>
      </div>
    )
  }

  if (!canScore) {
    return (
      <div className="text-center py-12">
        <div className="font-display text-2xl mb-2" style={{ color: 'var(--navy)' }}>ACCESS DENIED</div>
        <p className="text-sm" style={{ color: 'var(--navy-muted)' }}>
          You need scorekeeper or admin access to score this game. Contact the team admin.
        </p>
      </div>
    )
  }

  const ourLineup = ourSide === 'home' ? homeLineup : awayLineup
  const themLineup = ourSide === 'home' ? awayLineup : homeLineup
  const ourSetter = ourSide === 'home' ? setHomeLineup : setAwayLineup
  const themSetter = ourSide === 'home' ? setAwayLineup : setHomeLineup

  const currentLineup = activeTab === 'our' ? ourLineup : themLineup
  const currentSetter = activeTab === 'our' ? ourSetter : themSetter
  const currentRoster = activeTab === 'our' ? (team?.players || []) : (opponentTeam?.players || [])

  // Players already in lineup
  const assignedNames = new Set(currentLineup.filter(e => e.playerName).map(e => e.playerName))
  const availablePlayers = currentRoster.filter(p => !assignedNames.has(p.name))

  function assignPlayer(player) {
    // Find first empty slot
    const emptyIdx = currentLineup.findIndex(e => !e.playerName)
    if (emptyIdx === -1) return
    currentSetter(prev => {
      const next = [...prev]
      next[emptyIdx] = {
        playerName: player.name,
        jerseyNumber: player.number || '',
        position: player.position || '',
      }
      return next
    })
  }

  function removeFromSlot(idx) {
    currentSetter(prev => {
      const next = [...prev]
      next[idx] = { playerName: '', jerseyNumber: '', position: '' }
      return next
    })
  }

  function moveSlot(fromIdx, direction) {
    const toIdx = fromIdx + direction
    if (toIdx < 0 || toIdx >= currentLineup.length) return
    currentSetter(prev => {
      const next = [...prev]
      const temp = next[fromIdx]
      next[fromIdx] = next[toIdx]
      next[toIdx] = temp
      return next
    })
  }

  const hasEnough = ourLineup.some(e => e.playerName) && themLineup.some(e => e.playerName)

  async function handleSaveAndStart() {
    setSaving(true)
    try {
      const opponentName = game?.opponent_name || 'Opponent'
      const homeTeamName = ourSide === 'home' ? (team?.name || 'Home') : opponentName
      const awayTeamName = ourSide === 'away' ? (team?.name || 'Away') : opponentName

      await initScorebookGame(parseInt(gameId), { homeTeamName, awayTeamName, ourSide })

      const homeEntries = homeLineup.map((e, i) => ({ battingOrder: i + 1, ...e }))
      const awayEntries = awayLineup.map((e, i) => ({ battingOrder: i + 1, ...e }))
      await saveLineup(parseInt(gameId), { teamSide: 'home', entries: homeEntries })
      await saveLineup(parseInt(gameId), { teamSide: 'away', entries: awayEntries })
      await startScorebookGame(parseInt(gameId))

      navigate(`../game/${gameId}/score`, { relative: 'path' })
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-8">
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

      {/* Team Tabs */}
      <div className="flex rounded-xl overflow-hidden border-2 p-0.5 gap-0.5"
        style={{ borderColor: 'var(--border)', background: 'var(--sky)' }}>
        {['our', 'opp'].map(tab => {
          const label = tab === 'our'
            ? (team?.name?.toUpperCase() || 'OUR TEAM')
            : (game?.opponent_name?.toUpperCase() || 'OPPONENT')
          const count = (tab === 'our' ? ourLineup : themLineup).filter(e => e.playerName).length
          return (
            <button key={tab}
              className="flex-1 py-2.5 rounded-lg font-display text-base tracking-wider transition-all"
              style={{
                background: activeTab === tab ? 'var(--navy)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--navy-muted)',
              }}
              onClick={() => setActiveTab(tab)}>
              <span className="truncate block px-1">{label}</span>
              <span className="text-[10px] opacity-70">{count}/9</span>
            </button>
          )
        })}
      </div>

      {/* Batting Order Slots */}
      <div>
        <div className="section-label mb-2">BATTING ORDER</div>
        <div className="space-y-1.5">
          {currentLineup.map((entry, idx) => {
            const filled = !!entry.playerName
            return (
              <div key={idx}
                className="flex items-center gap-2 py-2 px-2 rounded-xl transition-all"
                style={{
                  borderLeft: `3px solid ${filled ? 'var(--gold)' : 'var(--border)'}`,
                  background: filled ? 'rgba(212,168,50,0.06)' : 'var(--cream)',
                }}>
                <span className="font-display text-lg w-6 text-center flex-shrink-0"
                  style={{ color: 'var(--navy-muted)' }}>{idx + 1}</span>

                {filled ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--navy)' }}>
                        {entry.playerName}
                      </div>
                      <div className="flex gap-2 items-center">
                        {entry.jerseyNumber && (
                          <span className="text-xs" style={{ color: 'var(--gold-dark, #b8891e)' }}>#{entry.jerseyNumber}</span>
                        )}
                        {entry.position && (
                          <span className="text-xs font-bold" style={{ color: 'var(--navy-muted)' }}>{entry.position}</span>
                        )}
                      </div>
                    </div>
                    {/* Reorder arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button className="w-7 h-5 rounded text-xs flex items-center justify-center"
                        style={{ background: 'var(--sky)', color: idx === 0 ? 'var(--border)' : 'var(--navy)' }}
                        disabled={idx === 0}
                        onClick={() => moveSlot(idx, -1)}>
                        ▲
                      </button>
                      <button className="w-7 h-5 rounded text-xs flex items-center justify-center"
                        style={{ background: 'var(--sky)', color: idx === currentLineup.length - 1 ? 'var(--border)' : 'var(--navy)' }}
                        disabled={idx === currentLineup.length - 1}
                        onClick={() => moveSlot(idx, 1)}>
                        ▼
                      </button>
                    </div>
                    {/* Remove */}
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-sm active:scale-95"
                      style={{ background: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' }}
                      onClick={() => removeFromSlot(idx)}>
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="flex-1 text-sm italic py-1.5" style={{ color: 'var(--navy-muted)' }}>
                    Tap a player below to add
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Available Players */}
      {currentRoster.length > 0 && (
        <div>
          <div className="section-label mb-2">
            AVAILABLE PLAYERS ({availablePlayers.length})
          </div>
          {availablePlayers.length === 0 ? (
            <div className="text-sm text-center py-4" style={{ color: 'var(--navy-muted)' }}>
              All players assigned to lineup
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {availablePlayers.map(player => (
                <button key={player.id || player.name}
                  className="flex items-center gap-2 p-2.5 rounded-xl text-left active:scale-95 transition-transform"
                  style={{ background: 'var(--sky)', border: '1px solid var(--border)' }}
                  onClick={() => assignPlayer(player)}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm text-white flex-shrink-0"
                    style={{ background: 'var(--navy)' }}>
                    {player.number || player.name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--navy)' }}>
                      {player.name}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: 'var(--navy-muted)' }}>
                      {player.position || '—'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual add (when no roster) */}
      {currentRoster.length === 0 && (
        <ManualAddForm onAdd={(name) => {
          const emptyIdx = currentLineup.findIndex(e => !e.playerName)
          if (emptyIdx === -1) return
          currentSetter(prev => {
            const next = [...prev]
            next[emptyIdx] = { playerName: name, jerseyNumber: '', position: '' }
            return next
          })
        }} />
      )}

      {/* Save & Start */}
      <button
        className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white transition-opacity active:scale-95"
        style={{ background: hasEnough ? 'var(--navy)' : 'var(--navy-muted)', opacity: hasEnough ? 1 : 0.5 }}
        disabled={!hasEnough || saving}
        onClick={handleSaveAndStart}>
        {saving ? 'STARTING...' : 'SAVE & START GAME'}
      </button>

      <p className="text-center text-xs" style={{ color: 'var(--navy-muted)' }}>
        Tap players to add. Use arrows to reorder. You can add more during the game.
      </p>
    </div>
  )
}

function ManualAddForm({ onAdd }) {
  const [name, setName] = useState('')
  return (
    <div className="card p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--navy-muted)' }}>
        ADD PLAYER
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 h-10 px-3 rounded-lg border text-sm font-medium focus:outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
          placeholder="Player name..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setName('') } }}
        />
        <button
          className="h-10 px-4 rounded-lg font-display text-sm tracking-wider text-white active:scale-95"
          style={{ background: name.trim() ? 'var(--navy)' : 'var(--navy-muted)' }}
          disabled={!name.trim()}
          onClick={() => { onAdd(name.trim()); setName('') }}>
          ADD
        </button>
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
