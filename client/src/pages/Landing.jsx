import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTeams } from '../api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Landing() {
  const [teams, setTeams] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Hero Header */}
      <header className="relative overflow-hidden py-12 px-6 text-center" style={{ background: 'var(--navy)' }}>
        <div className="relative z-10 max-w-lg mx-auto">
          <h1 className="font-display text-5xl text-white tracking-wider">BLEACHERBOX</h1>
          <p className="text-sm mt-2 font-medium" style={{ color: 'var(--gold)' }}>
            Schedules, pitch counts & scouting for baseball parents
          </p>
        </div>
        <div className="stitch-line mt-8" />
      </header>

      {/* Team List */}
      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <div className="section-label mb-4">Teams</div>

        {loading && <LoadingSpinner />}

        {!loading && teams?.length === 0 && (
          <div className="text-center py-12">
            <div className="font-display text-xl" style={{ color: 'var(--navy-muted)' }}>NO TEAMS YET</div>
            <p className="text-sm mt-1" style={{ color: 'var(--navy-muted)' }}>Teams will appear here once they're registered.</p>
          </div>
        )}

        <div className="space-y-3">
          {teams?.map((team, i) => (
            <Link
              key={`${team.pg_org_id}-${team.pg_team_id}`}
              to={`/${team.slug}`}
              className="card-enter card block no-underline overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-4 p-4">
                <img
                  src={team.logo_url || '/yardbirds-logo.png'}
                  alt=""
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl leading-tight" style={{ color: 'var(--navy)' }}>
                    {team.name || team.slug}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {team.age_group && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>
                        {team.age_group}
                      </span>
                    )}
                    {team.classification && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                        {team.classification}
                      </span>
                    )}
                    {team.hometown && (
                      <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>{team.hometown}</span>
                    )}
                  </div>
                  {team.record && (
                    <div className="font-display text-lg mt-1" style={{ color: 'var(--navy)' }}>{team.record}</div>
                  )}
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--navy-muted)' }}>
        BleacherBox
      </footer>
    </div>
  )
}
