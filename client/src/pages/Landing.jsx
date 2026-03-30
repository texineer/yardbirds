import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTeams } from '../api'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Landing() {
  const [teams, setTeams] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user, roles, logout, loading: authLoading } = useAuth()

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false))
  }, [])

  const myTeamSlugs = new Set(roles.map(r => r.slug))

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
        {/* Auth bar */}
        <div className="relative z-10 mt-4 flex justify-center gap-3">
          {!authLoading && user ? (
            <>
              <span className="text-xs font-semibold text-white opacity-70">
                {user.display_name || user.email}
              </span>
              <button
                onClick={logout}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded no-underline"
                style={{ color: 'var(--navy)', background: 'var(--gold)' }}>
                Sign Out
              </button>
            </>
          ) : !authLoading ? (
            <Link to="/login"
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded no-underline"
              style={{ color: 'var(--navy)', background: 'var(--gold)' }}>
              Sign In
            </Link>
          ) : null}
        </div>
        <div className="stitch-line mt-8" />
      </header>

      {/* Team List */}
      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {loading && <LoadingSpinner />}

        {/* My Teams (logged in with roles) */}
        {!loading && user && roles.length > 0 && (
          <>
            <div className="section-label mb-4">My Teams</div>
            <div className="space-y-3 mb-8">
              {roles.map((role, i) => (
                <Link
                  key={`${role.pg_org_id}-${role.pg_team_id}`}
                  to={`/${role.slug}`}
                  className="card-enter card block no-underline overflow-hidden"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-4 p-4">
                    <img
                      src={role.logo_url || '/yardbirds-logo.png'}
                      alt=""
                      className="w-14 h-14 object-contain shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-xl leading-tight" style={{ color: 'var(--navy)' }}>
                        {role.team_name || role.slug}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {role.age_group && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>
                            {role.age_group}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                          {role.role.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="section-label mb-4">
          {user && roles.length > 0 ? 'All Teams' : 'Teams'}
        </div>

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
