import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTeams } from '../api'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

function AuthForm() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto w-full">
      {/* Toggle tabs */}
      <div className="flex rounded-xl overflow-hidden border-2 p-0.5 gap-0.5 mb-6"
        style={{ borderColor: 'var(--border)', background: 'var(--sky)' }}>
        {['login', 'register'].map(m => (
          <button key={m}
            className="flex-1 py-2.5 rounded-lg font-display text-lg tracking-wider transition-all"
            style={{
              background: mode === m ? 'var(--navy)' : 'transparent',
              color: mode === m ? 'white' : 'var(--navy-muted)',
            }}
            onClick={() => { setMode(m); setError('') }}>
            {m === 'login' ? 'SIGN IN' : 'REGISTER'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: 'var(--navy-muted)' }}>Display Name</label>
            <input
              type="text"
              className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
            style={{ color: 'var(--navy-muted)' }}>Email</label>
          <input
            type="email"
            required
            className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
            style={{ color: 'var(--navy-muted)' }}>Password</label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
            placeholder={mode === 'register' ? 'Min 8 characters' : 'Your password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="text-sm font-semibold text-center py-2 px-3 rounded-lg"
            style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
          style={{ background: loading ? 'var(--navy-muted)' : 'var(--navy)' }}>
          {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>
      </form>
    </div>
  )
}

export default function Landing() {
  const [teams, setTeams] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user, roles, logout, loading: authLoading } = useAuth()

  useEffect(() => {
    if (user) {
      getTeams()
        .then(setTeams)
        .catch(() => setTeams([]))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

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
        {/* Sign out (only when logged in) */}
        {!authLoading && user && (
          <div className="relative z-10 mt-4 flex justify-center gap-3">
            <span className="text-xs font-semibold text-white opacity-70">
              {user.display_name || user.email}
            </span>
            <button
              onClick={logout}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded no-underline"
              style={{ color: 'var(--navy)', background: 'var(--gold)' }}>
              Sign Out
            </button>
          </div>
        )}
        <div className="stitch-line mt-8" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {authLoading && <LoadingSpinner />}

        {/* Not logged in: show login form */}
        {!authLoading && !user && <AuthForm />}

        {/* Logged in: show teams */}
        {!authLoading && user && (
          <>
            {loading && <LoadingSpinner />}

            {/* My Teams */}
            {!loading && roles.length > 0 && (
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

            {/* All Teams */}
            <div className="section-label mb-4">
              {roles.length > 0 ? 'All Teams' : 'Teams'}
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
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--navy-muted)' }}>
        BleacherBox
      </footer>
    </div>
  )
}
