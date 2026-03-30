import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTeams, joinTeam, leaveTeam } from '../api'
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
      if (mode === 'login') await login(email, password)
      else await register(email, password, displayName)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-sm mx-auto w-full">
      <div className="flex rounded-xl overflow-hidden border-2 p-0.5 gap-0.5 mb-6"
        style={{ borderColor: 'var(--border)', background: 'var(--sky)' }}>
        {['login', 'register'].map(m => (
          <button key={m}
            className="flex-1 py-2.5 rounded-lg font-display text-lg tracking-wider transition-all"
            style={{ background: mode === m ? 'var(--navy)' : 'transparent', color: mode === m ? 'white' : 'var(--navy-muted)' }}
            onClick={() => { setMode(m); setError('') }}>
            {m === 'login' ? 'SIGN IN' : 'REGISTER'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--navy-muted)' }}>Display Name</label>
            <input type="text" className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
              placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--navy-muted)' }}>Email</label>
          <input type="email" required className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
            placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--navy-muted)' }}>Password</label>
          <input type="password" required minLength={8} className="w-full h-12 px-4 rounded-xl border-2 text-sm font-medium focus:outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--navy)', background: 'var(--cream)' }}
            placeholder={mode === 'register' ? 'Min 8 characters' : 'Your password'}
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && (
          <div className="text-sm font-semibold text-center py-2 px-3 rounded-lg"
            style={{ color: 'var(--loss)', background: 'var(--loss-bg, #fdecea)' }}>{error}</div>
        )}
        <button type="submit" disabled={loading}
          className="w-full h-14 rounded-xl font-display text-xl tracking-widest text-white active:scale-95 transition-transform"
          style={{ background: loading ? 'var(--navy-muted)' : 'var(--navy)' }}>
          {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>
      </form>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { user, roles, logout, refreshRoles, loading: authLoading } = useAuth()
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [allTeams, setAllTeams] = useState([])
  const [loadingTeams, setLoadingTeams] = useState(false)

  // Auto-redirect to default team if user has exactly one team
  useEffect(() => {
    if (!authLoading && user && roles.length === 1) {
      navigate(`/${roles[0].slug}`, { replace: true })
    }
  }, [authLoading, user, roles])

  // Load all available teams when "Add Team" is opened
  useEffect(() => {
    if (showAddTeam && allTeams.length === 0) {
      setLoadingTeams(true)
      getTeams().then(setAllTeams).catch(() => setAllTeams([])).finally(() => setLoadingTeams(false))
    }
  }, [showAddTeam])

  const myTeamKeys = new Set(roles.map(r => `${r.pg_org_id}-${r.pg_team_id}`))
  const availableTeams = allTeams.filter(t => !myTeamKeys.has(`${t.pg_org_id}-${t.pg_team_id}`))

  async function handleJoin(team) {
    try {
      await joinTeam(team.pg_org_id, team.pg_team_id)
      await refreshRoles()
    } catch (err) { console.error(err) }
  }

  async function handleLeave(role) {
    if (!confirm(`Remove ${role.team_name || role.slug} from your teams?`)) return
    try {
      await leaveTeam(role.pg_org_id, role.pg_team_id)
      await refreshRoles()
    } catch (err) { console.error(err) }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="relative overflow-hidden py-10 px-6 text-center" style={{ background: 'var(--navy)' }}>
        <div className="relative z-10 max-w-lg mx-auto">
          <h1 className="font-display text-5xl text-white tracking-wider">BLEACHERBOX</h1>
          <p className="text-sm mt-2 font-medium" style={{ color: 'var(--gold)' }}>
            Schedules, pitch counts & scouting for baseball parents
          </p>
        </div>
        {!authLoading && user && (
          <div className="relative z-10 mt-4 flex justify-center items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
                {(user.display_name || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-white">{user.display_name || user.email}</span>
            </div>
            <button onClick={logout}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
              style={{ color: 'var(--navy)', background: 'var(--gold)' }}>
              Sign Out
            </button>
          </div>
        )}
        <div className="stitch-line mt-6" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {authLoading && <LoadingSpinner />}

        {/* Not logged in */}
        {!authLoading && !user && <AuthForm />}

        {/* Logged in */}
        {!authLoading && user && (
          <div className="space-y-4">
            {/* My Teams */}
            <div className="flex items-center justify-between">
              <div className="section-label">My Teams</div>
              <button onClick={() => setShowAddTeam(v => !v)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                style={{ background: showAddTeam ? 'var(--navy)' : 'var(--gold)', color: showAddTeam ? 'white' : 'var(--navy)' }}>
                {showAddTeam ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    Close
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Add Team
                  </>
                )}
              </button>
            </div>

            {/* Team cards */}
            {roles.length > 0 ? (
              <div className="space-y-2">
                {roles.map((role, i) => (
                  <div key={`${role.pg_org_id}-${role.pg_team_id}`}
                    className="card-enter card overflow-hidden"
                    style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-center gap-3 p-3">
                      <Link to={`/${role.slug}`} className="flex items-center gap-3 flex-1 min-w-0 no-underline">
                        <img src={role.logo_url || '/yardbirds-logo.png'} alt="" className="w-12 h-12 object-contain shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-lg leading-tight truncate" style={{ color: 'var(--navy)' }}>
                            {role.team_name || role.slug}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {role.age_group && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>{role.age_group}</span>
                            )}
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'var(--gold)', color: 'var(--navy)' }}>{role.role.toUpperCase()}</span>
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </Link>
                      {/* Remove button (only for viewer role, admins can't self-remove easily) */}
                      {role.role === 'viewer' && (
                        <button onClick={() => handleLeave(role)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 active:scale-95"
                          style={{ background: 'var(--loss-bg, #fdecea)', color: 'var(--loss)' }}
                          title="Remove from my teams">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-6 text-center">
                <div className="font-display text-xl mb-1" style={{ color: 'var(--navy-muted)' }}>NO TEAMS YET</div>
                <p className="text-sm" style={{ color: 'var(--navy-muted)' }}>Tap "Add Team" to follow a team</p>
              </div>
            )}

            {/* Add Team panel */}
            {showAddTeam && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3" style={{ background: 'var(--navy)' }}>
                  <div className="font-display text-base text-white tracking-wider">ADD A TEAM</div>
                  <div className="text-[10px] text-white/50 mt-0.5">Select a team to follow</div>
                </div>
                {loadingTeams ? (
                  <div className="p-4"><LoadingSpinner /></div>
                ) : availableTeams.length === 0 ? (
                  <div className="p-4 text-sm text-center" style={{ color: 'var(--navy-muted)' }}>
                    {allTeams.length === 0 ? 'No teams available' : 'You\'re following all available teams'}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {availableTeams.map(t => (
                      <button key={`${t.pg_org_id}-${t.pg_team_id}`}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--sky)]"
                        onClick={() => handleJoin(t)}>
                        <img src={t.logo_url || '/yardbirds-logo.png'} alt="" className="w-10 h-10 object-contain shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: 'var(--navy)' }}>{t.name}</div>
                          <div className="flex gap-1.5 mt-0.5">
                            {t.age_group && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>{t.age_group}</span>
                            )}
                            {t.hometown && (
                              <span className="text-[9px]" style={{ color: 'var(--navy-muted)' }}>{t.hometown}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0"
                          style={{ background: 'var(--win-bg)', color: 'var(--win)' }}>
                          + Add
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--navy-muted)' }}>
        BleacherBox
      </footer>
    </div>
  )
}
