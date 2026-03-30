import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTeam, getSchedule, triggerScrape, getTournamentTeams } from '../api'
import GameCard from '../components/GameCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Dashboard({ orgId, teamId, slug }) {
  const [team, setTeam] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scraping, setScraping] = useState(false)

  useEffect(() => {
    loadData()
  }, [orgId, teamId])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [teamData, scheduleData] = await Promise.all([
        getTeam(orgId, teamId),
        getSchedule(orgId, teamId),
      ])
      setTeam(teamData)
      setSchedule(scheduleData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleScrape() {
    setScraping(true)
    try {
      await triggerScrape(slug)
      // Scrape runs in background on server — poll until data refreshes
      const poll = async (attempts = 0) => {
        if (attempts >= 6) { setScraping(false); return }
        await new Promise(r => setTimeout(r, 5000))
        await loadData()
        setScraping(false)
      }
      poll()
    } catch (err) {
      setError(err.message)
      setScraping(false)
    }
  }

  if (loading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="text-center py-16">
        <img src={team?.logo_url || '/yardbirds-logo.png'} alt="" className="w-20 h-20 object-contain mx-auto mb-4 opacity-40" />
        <div className="font-display text-2xl mb-2" style={{ color: 'var(--navy-muted)' }}>NO DATA YET</div>
        <p className="text-sm mb-6" style={{ color: 'var(--navy-muted)' }}>{error}</p>
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="btn-gold px-6 py-3 rounded-lg text-sm disabled:opacity-50"
        >
          {scraping ? 'Loading data...' : 'Load Team Data'}
        </button>
      </div>
    )
  }

  // Combined record from all sources (PG + Five Tool)
  const cr = team?.combinedRecord
  const wins = cr ? String(cr.wins || 0) : '0'
  const losses = cr ? String(cr.losses || 0) : '0'
  const ties = cr ? String(cr.ties || 0) : '0'

  // Sort tournaments by start date — next occurring first, then chronologically
  const now = new Date().toISOString().slice(0, 10)
  const tournaments = (schedule?.tournaments || []).slice().sort((a, b) => {
    const dateA = a.tournament.start_date || '9999'
    const dateB = b.tournament.start_date || '9999'
    // Upcoming tournaments first (nearest date), then past (most recent first)
    const aFuture = dateA >= now
    const bFuture = dateB >= now
    if (aFuture && !bFuture) return -1
    if (!aFuture && bFuture) return 1
    if (aFuture && bFuture) return dateA.localeCompare(dateB)  // nearest upcoming first
    return dateB.localeCompare(dateA)  // most recent past first
  })

  return (
    <div className="space-y-6">
      {/* Team Hero */}
      <div className="card relative overflow-hidden">
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--powder), var(--gold), var(--powder))' }} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <img src={team?.logo_url || '/yardbirds-logo.png'} alt="" className="w-16 h-16 object-contain shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl leading-none" style={{ color: 'var(--navy)' }}>
                {team?.name || 'Team'}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {team?.age_group && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>
                    {team.age_group}
                  </span>
                )}
                {team?.classification && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                    {team.classification}
                  </span>
                )}
                {team?.hometown && (
                  <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>{team.hometown}</span>
                )}
              </div>
              {/* Record */}
              <div className="font-display text-4xl leading-none mt-3" style={{ color: 'var(--navy)' }}>
                {wins}<span className="opacity-20">-</span>{losses}<span className="opacity-20">-</span>{ties}
              </div>
            </div>
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-70 transition-colors"
              style={{ background: scraping ? 'var(--powder-pale)' : 'var(--gold)', color: 'var(--navy)' }}
            >
              {scraping ? (
                <>
                  <svg className="diamond-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
                  Sync
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Schedule grouped by tournament */}
      {tournaments.length === 0 && (
        <div className="text-center py-8">
          <div className="font-display text-xl" style={{ color: 'var(--navy-muted)' }}>NO GAMES YET</div>
          <p className="text-sm mt-1" style={{ color: 'var(--navy-muted)' }}>Tap Sync to load schedule data.</p>
        </div>
      )}

      {tournaments.map(({ tournament: t, games }) => {
        // Extract unique opponent names from games in this tournament
        const opponents = [...new Set(games.map(g => g.opponent_name).filter(Boolean))].sort()
        return (
          <div key={t.pg_event_id}>
            {/* Tournament header */}
            <div className="rounded-t-xl px-4 py-3" style={{ background: 'var(--navy)' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {t.pg_url ? (
                    <a href={t.pg_url} target="_blank" rel="noopener" className="font-display text-lg text-white leading-tight truncate block no-underline hover:underline">{t.name}</a>
                  ) : (
                    <div className="font-display text-lg text-white leading-tight truncate">{t.name}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {t.start_date && (
                      <span className="text-[10px] font-bold text-white/50">
                        {formatDate(t.start_date)}{t.end_date && t.end_date !== t.start_date ? ` — ${formatDate(t.end_date)}` : ''}
                      </span>
                    )}
                    {t.location && (
                      <span className="text-[10px] text-white/40 truncate">{t.location}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 ml-2 flex-shrink-0">
                  {t.source !== 'ft' && (
                    <Link to={`tournament/${t.pg_event_id}/bracket`}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded no-underline"
                      style={{ background: 'rgba(212,168,50,0.2)', color: 'var(--gold)' }}>
                      Bracket
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Games or Teams list */}
            <div className="rounded-b-xl overflow-hidden border border-t-0 mb-1" style={{ borderColor: 'var(--border)' }}>
              {games.length === 0 ? (
                <div className="p-4">
                  <div className="text-sm text-center mb-3" style={{ color: 'var(--navy-muted)' }}>Schedule not available yet</div>
                  <TeamsInTournament eventId={t.pg_event_id} pgUrl={t.pg_url} source={t.source} ageGroup={team?.age_group} />
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {games.sort((a, b) => (a.game_date || '').localeCompare(b.game_date || '') || (a.game_time || '').localeCompare(b.game_time || '')).map((g, i) => (
                    <GameCard key={g.id} game={g} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Roster */}
      {team?.players?.length > 0 && (
        <div>
          <div className="section-label mb-2">Roster</div>
          <div className="card overflow-hidden">
            <table className="w-full stat-table">
              <thead>
                <tr>
                  <th className="text-left w-10">#</th>
                  <th className="text-left">Name</th>
                  <th className="text-left">Pos</th>
                  <th className="text-left">B/T</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((p, i) => (
                  <tr key={i}>
                    <td className="font-display text-lg" style={{ color: 'var(--navy-muted)' }}>{p.number}</td>
                    <td className="font-semibold">{p.name}</td>
                    <td style={{ color: 'var(--navy-muted)' }}>{p.position}</td>
                    <td style={{ color: 'var(--navy-muted)' }}>{p.bats}/{p.throws}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamsInTournament({ eventId, pgUrl, source, ageGroup }) {
  const [teams, setTeams] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getTournamentTeams(eventId, ageGroup)
      .then(t => setTeams(t))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false))
  }, [eventId, ageGroup])

  if (loading) return <div className="text-xs text-center py-2" style={{ color: 'var(--navy-muted)' }}>Loading teams...</div>

  if (!teams || teams.length === 0) {
    return pgUrl ? (
      <div className="text-center">
        <a href={pgUrl} target="_blank" rel="noopener"
          className="inline-block text-xs font-bold no-underline px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
          Check {source === 'ft' ? 'Five Tool' : 'Perfect Game'} for updates
        </a>
      </div>
    ) : null
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--navy-muted)' }}>
        REGISTERED TEAMS ({teams.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {teams.map((t, i) => (
          <span key={t.name + i}
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--sky)', color: 'var(--navy)', border: '1px solid var(--border)' }}>
            {t.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return dateStr }
}
