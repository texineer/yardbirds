import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournamentBracket } from '../api'
import LoadingSpinner from '../components/LoadingSpinner'

const PG_BASE = 'https://www.perfectgame.org'

export default function TournamentBracket() {
  const { eventId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    getTournamentBracket(eventId)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [eventId])

  if (loading) return <LoadingSpinner />

  const tournament = data?.tournament
  const brackets = data?.brackets || []
  const hasBrackets = brackets.length > 0 && brackets.some(b => b.games?.length > 0)
  const activeBracket = brackets[activeTab] || brackets[0]

  return (
    <div className="space-y-4">
      <Link to="../schedule" className="inline-flex items-center gap-1 text-xs font-semibold no-underline" style={{ color: 'var(--navy-muted)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Schedule
      </Link>

      <div>
        <h1 className="font-display text-3xl" style={{ color: 'var(--navy)' }}>BRACKET</h1>
        {tournament && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--navy-muted)' }}>{tournament.name}</p>
        )}
      </div>

      {error && (
        <div className="text-sm font-semibold py-2 px-3 rounded-lg" style={{ color: 'var(--loss)', background: 'var(--loss-bg)' }}>{error}</div>
      )}

      {!hasBrackets ? (
        <div className="space-y-4">
          <div className="card p-6 text-center">
            <div className="font-display text-xl mb-2" style={{ color: 'var(--navy-muted)' }}>NO BRACKETS YET</div>
            <p className="text-sm" style={{ color: 'var(--navy-muted)' }}>
              Brackets will appear after pool play is complete. Check the PG site for the latest.
            </p>
          </div>
          <a href={`${PG_BASE}/events/Brackets.aspx?event=${eventId}`} target="_blank" rel="noopener"
            className="card block no-underline p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gold)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4v6h4M4 7h8v5M20 4v6h-4M20 7h-8v5M8 17v3h8v-3"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: 'var(--navy)' }}>View on Perfect Game</div>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'var(--gold)', color: 'var(--navy)' }}>Open</span>
            </div>
          </a>
        </div>
      ) : (
        <>
          {/* Bracket tabs (if multiple) */}
          {brackets.length > 1 && (
            <div className="flex rounded-xl overflow-hidden border-2 p-0.5 gap-0.5"
              style={{ borderColor: 'var(--border)', background: 'var(--sky)' }}>
              {brackets.map((b, i) => (
                <button key={i}
                  className="flex-1 py-2 rounded-lg font-display text-sm tracking-wider transition-all"
                  style={{
                    background: activeTab === i ? 'var(--navy)' : 'transparent',
                    color: activeTab === i ? 'white' : 'var(--navy-muted)',
                  }}
                  onClick={() => setActiveTab(i)}>
                  {b.name?.replace(/^\d+U\s+(?:OPEN\s+)?/i, '').replace(/\s+BRACKET$/i, '') || `Bracket ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Bracket title */}
          {activeBracket && (
            <div className="section-label">{activeBracket.name}</div>
          )}

          {/* Bracket games grouped by round */}
          {activeBracket && <BracketTree games={activeBracket.games} />}

          {/* PG link */}
          <a href={`${PG_BASE}/events/Brackets.aspx?event=${eventId}`} target="_blank" rel="noopener"
            className="block text-center text-xs font-bold no-underline py-2" style={{ color: 'var(--navy-muted)' }}>
            View on PerfectGame.org
          </a>
        </>
      )}
    </div>
  )
}

function BracketTree({ games }) {
  if (!games || games.length === 0) return null

  // Group by round
  const rounds = {}
  for (const g of games) {
    const round = g.round || g.bracket_round || 'Game'
    if (!rounds[round]) rounds[round] = []
    rounds[round].push(g)
  }

  // Order rounds: Quarterfinal → Semifinal → Final
  const roundOrder = ['Quarterfinal', 'Semifinal', 'Final', 'Game']
  const sortedRounds = Object.entries(rounds).sort(([a], [b]) => {
    const ai = roundOrder.indexOf(a)
    const bi = roundOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="space-y-4">
      {sortedRounds.map(([round, roundGames]) => (
        <div key={round}>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--gold-dark)' }}>
            {round === 'Final' ? 'CHAMPIONSHIP' : round.toUpperCase()}
          </div>
          <div className="space-y-2">
            {roundGames.map((game, i) => (
              <GameCard key={i} game={game} isFinal={round === 'Final'} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function GameCard({ game, isFinal }) {
  // Handle both scraped format (homeTeam/awayTeam objects) and DB format (opponent_name, etc.)
  const homeTeam = game.homeTeam || { name: game.opponent_name?.split(' vs ')[0] || '?', seed: game.home_seed, score: game.score_us }
  const awayTeam = game.awayTeam || { name: game.opponent_name?.split(' vs ')[1] || '?', seed: game.away_seed, score: game.score_them }
  const gameTime = game.gameTime || game.game_time || ''
  const field = game.field || ''
  const gameDate = game.gameDate || game.game_date || ''
  const homeWon = homeTeam.score != null && awayTeam.score != null && homeTeam.score > awayTeam.score
  const awayWon = homeTeam.score != null && awayTeam.score != null && awayTeam.score > homeTeam.score

  return (
    <div className="card overflow-hidden" style={{ borderColor: isFinal ? 'var(--gold)' : undefined, borderWidth: isFinal ? '2px' : undefined }}>
      {/* Game info header */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--sky)' }}>
        <span className="text-[10px] font-bold" style={{ color: 'var(--navy-muted)' }}>
          {gameDate && formatBracketDate(gameDate)} {gameTime && `· ${gameTime}`}
        </span>
        {field && (
          <span className="text-[10px] font-bold truncate ml-2" style={{ color: 'var(--navy-muted)' }}>
            {field}
          </span>
        )}
      </div>

      {/* Home team */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)', background: homeWon ? 'rgba(27,115,64,0.04)' : undefined }}>
        {homeTeam.seed && (
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'var(--navy)', color: 'white' }}>
            {homeTeam.seed}
          </span>
        )}
        <span className={`flex-1 text-sm truncate ${homeWon ? 'font-bold' : 'font-medium'}`}
          style={{ color: 'var(--navy)' }}>
          {homeTeam.name}
        </span>
        <span className={`font-display text-xl w-8 text-right ${homeWon ? '' : 'opacity-60'}`}
          style={{ color: homeWon ? 'var(--win)' : 'var(--navy)' }}>
          {homeTeam.score ?? '—'}
        </span>
      </div>

      {/* Away team */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: awayWon ? 'rgba(27,115,64,0.04)' : undefined }}>
        {awayTeam.seed && (
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'var(--navy-muted)', color: 'white' }}>
            {awayTeam.seed}
          </span>
        )}
        <span className={`flex-1 text-sm truncate ${awayWon ? 'font-bold' : 'font-medium'}`}
          style={{ color: 'var(--navy)' }}>
          {awayTeam.name}
        </span>
        <span className={`font-display text-xl w-8 text-right ${awayWon ? '' : 'opacity-60'}`}
          style={{ color: awayWon ? 'var(--win)' : 'var(--navy)' }}>
          {awayTeam.score ?? '—'}
        </span>
      </div>
    </div>
  )
}

function formatBracketDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return dateStr }
}
