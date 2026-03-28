import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTeam, getSchedule, triggerScrape, getConfig } from '../api'
import GameCard from '../components/GameCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Dashboard({ orgId, teamId }) {
  const [team, setTeam] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scraping, setScraping] = useState(false)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    loadData()
    getConfig().then(setConfig).catch(() => {})
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
      await triggerScrape(orgId, teamId)
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
        <img src={config?.teamLogo || '/yardbirds-logo.png'} alt="" className="w-20 h-20 object-contain mx-auto mb-4 opacity-40" />
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

  const allGames = schedule?.tournaments?.flatMap(t => t.games) || []
  const now = new Date().toISOString().slice(0, 10)
  const upcoming = allGames.filter(g => !g.result && (g.game_date >= now || !g.game_date)).sort((a, b) => (a.game_date || '').localeCompare(b.game_date || ''))
  const recent = allGames.filter(g => g.result).sort((a, b) => b.game_date.localeCompare(a.game_date)).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Team Hero */}
      <div className="card relative overflow-hidden">
        {/* Powder blue accent strip at top */}
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--powder), var(--gold), var(--powder))' }} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <img src={config?.teamLogo || '/yardbirds-logo.png'} alt="Yardbirds" className="w-16 h-16 object-contain shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="section-label mb-0.5">Team</div>
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

          {/* Record */}
          {team?.record && (
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="font-display text-5xl leading-none" style={{ color: 'var(--navy)' }}>
                  {wins}<span className="opacity-20">-</span>{losses}<span className="opacity-20">-</span>{ties}
                </div>
                <div className="section-label mt-1">Season Record</div>
              </div>
              <Link
                to="/schedule"
                className="btn-gold text-xs no-underline px-3 py-1.5 rounded-lg mb-1"
              >
                Full Schedule
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Next Game */}
      {upcoming.length > 0 && (
        <div>
          <div className="section-label mb-2">Next Up</div>
          <GameCard game={upcoming[0]} highlight index={0} />
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 1 && (
        <div>
          <div className="section-label mb-2">Upcoming</div>
          <div className="space-y-2">
            {upcoming.slice(1, 4).map((g, i) => (
              <GameCard key={g.id} game={g} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recent.length > 0 && (
        <div>
          <div className="section-label mb-2">Recent Results</div>
          <div className="space-y-2">
            {recent.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} />
            ))}
          </div>
        </div>
      )}

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
