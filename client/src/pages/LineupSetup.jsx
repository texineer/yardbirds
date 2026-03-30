import { useState, useEffect, useRef } from 'react'
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
  const [opponentTeam, setOpponentTeam] = useState(null)

  useEffect(() => {
    Promise.all([
      getGame(gameId).catch(() => null),
      getTeamBySlug(slug).catch(() => null),
      getTeams().catch(() => []),
    ]).then(([g, t, allTeams]) => {
      setGame(g)
      setTeam(t)
      // Find opponent team by name and load their roster
      if (g?.opponent_name && allTeams.length) {
        const oppTeam = allTeams.find(at => at.name === g.opponent_name)
        if (oppTeam?.slug) {
          getTeamBySlug(oppTeam.slug)
            .then(setOpponentTeam)
            .catch(() => {})
        }
      }
      setLoading(false)
    })
  }, [gameId, slug])

  const canScore = !authLoading && user && team && hasTeamRole(team.pg_org_id, team.pg_team_id, ['admin', 'scorekeeper'])

  if (loading || authLoading) return <LoadingSpinner />

  // Auth gate
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

  function updateEntry(side, idx, field, value) {
    const setter = side === 'home' ? setHomeLineup : setAwayLineup
    setter(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function pickPlayer(setter, idx, player) {
    setter(prev => {
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        playerName: player.name,
        jerseyNumber: player.number || '',
        position: player.position || '',
      }
      return next
    })
  }

  async function handleSaveAndStart() {
    setSaving(true)
    try {
      const opponentName = game?.opponent_name || 'Opponent'
      const homeTeamName = ourSide === 'home' ? (team?.name || 'Home') : opponentName
      const awayTeamName = ourSide === 'away' ? (team?.name || 'Away') : opponentName

      await initScorebookGame(parseInt(gameId), { homeTeamName, awayTeamName, ourSide })

      // Save both lineups
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

  const ourLineup = ourSide === 'home' ? homeLineup : awayLineup
  const themLineup = ourSide === 'home' ? awayLineup : homeLineup
  const ourSetter = ourSide === 'home' ? setHomeLineup : setAwayLineup
  const themSetter = ourSide === 'home' ? setAwayLineup : setHomeLineup

  const hasEnough = ourLineup.some(e => e.playerName) && themLineup.some(e => e.playerName)

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
            const setter = activeTab === 'our' ? ourSetter : themSetter
            const players = activeTab === 'our'
              ? (team?.players || [])
              : (opponentTeam?.players || [])
            const filled = !!entry.playerName

            return (
              <div key={idx}>
                <div className="flex items-center gap-2 py-2 px-2 rounded-xl transition-colors"
                  style={{
                    borderLeft: `3px solid ${filled ? 'var(--gold)' : 'var(--border)'}`,
                    background: filled ? 'rgba(212,168,50,0.06)' : 'var(--cream)',
                  }}>
                  <span className="font-display text-lg w-6 text-center flex-shrink-0"
                    style={{ color: 'var(--navy-muted)' }}>{idx + 1}</span>
                  {players.length > 0 ? (
                    <select
                      className="flex-1 h-11 px-2 rounded-lg border text-sm font-medium focus:outline-none"
                      style={{ borderColor: 'var(--border)', color: filled ? 'var(--navy)' : 'var(--navy-muted)', background: 'var(--cream)' }}
                      value={entry.playerName}
                      onChange={e => {
                        const selected = players.find(p => p.name === e.target.value)
                        if (selected) {
                          pickPlayer(setter, idx, selected)
                        } else {
                          setter(prev => {
                            const next = [...prev]
                            next[idx] = { ...next[idx], playerName: '', jerseyNumber: '', position: '' }
                            return next
                          })
                        }
                      }}>
                      <option value="">Select player...</option>
                      {players.map(p => (
                        <option key={p.id || p.name} value={p.name}>
                          {p.name}{p.number ? ` #${p.number}` : ''}{p.position ? ` (${p.position})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
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
                    />
                  )}
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
