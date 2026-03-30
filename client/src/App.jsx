import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom'
import { getTeamBySlug } from './api'
import { useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import GameDetail from './pages/GameDetail'
import PitchingReport from './pages/PitchingReport'
import TeamSearch from './pages/TeamSearch'
import TournamentSchedule from './pages/TournamentSchedule'
import TournamentBracket from './pages/TournamentBracket'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import LineupSetup from './pages/LineupSetup'
import Scorebook from './pages/Scorebook'
import LiveScoreboard from './pages/LiveScoreboard'
import TeamMembers from './pages/TeamMembers'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const location = useLocation()

  return (
    <div className="flex flex-col min-h-dvh">
      <Routes>
        {/* Landing page — no header/nav */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth />} />
        {/* Team pages — with header/nav */}
        <Route path="/:slug/*" element={<TeamLayout />} />
      </Routes>
    </div>
  )
}

function TeamLayout() {
  const { slug } = useParams()
  const location = useLocation()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user, hasTeamRole } = useAuth()

  useEffect(() => {
    setLoading(true)
    getTeamBySlug(slug)
      .then(setTeam)
      .catch(() => setTeam(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="flex-1"><LoadingSpinner /></div>
  if (!team) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center py-16">
        <div className="font-display text-3xl" style={{ color: 'var(--navy)' }}>TEAM NOT FOUND</div>
        <p className="text-sm mt-2" style={{ color: 'var(--navy-muted)' }}>"{slug}" doesn't exist yet.</p>
        <Link to="/" className="inline-block mt-4 text-sm font-bold no-underline" style={{ color: 'var(--gold-dark)' }}>
          Back to all teams
        </Link>
      </div>
    </div>
  )

  const isAdmin = user && hasTeamRole(team.pg_org_id, team.pg_team_id, ['admin'])

  const navItems = [
    { path: `/${slug}`, label: 'Home', icon: HomeIcon },
    { path: `/${slug}/schedule`, label: 'Schedule', icon: CalendarIcon },
    { path: `/${slug}/search`, label: 'Teams', icon: SearchIcon },
    ...(isAdmin ? [{ path: `/${slug}/members`, label: 'Members', icon: MembersIcon }] : []),
  ]

  return (
    <>
      {/* Header */}
      <header className="relative overflow-hidden" style={{ background: 'var(--navy)' }}>
        <div className="relative px-4 py-2.5 flex items-center justify-between">
          <Link to={`/${slug}`} className="flex items-center gap-2.5 no-underline">
            <img src={team.logo_url || '/yardbirds-logo.png'} alt="" className="w-9 h-9 object-contain" />
            <div>
              <span className="font-display text-xl text-white tracking-wide leading-none">{(team.name || slug).toUpperCase()}</span>
              <img src="/bleacherbox_logo.png" alt="BleacherBox" className="h-3.5 object-contain" />
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-[10px] font-semibold text-white opacity-50 hidden sm:inline">
                {user.display_name || user.email}
              </span>
            )}
            <Link to="/" className="text-[10px] font-bold uppercase tracking-wider no-underline px-2 py-1 rounded" style={{ color: 'var(--gold)', background: 'rgba(255,255,255,0.1)' }}>
              All Teams
            </Link>
          </div>
        </div>
        <div className="stitch-line" />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard orgId={team.pg_org_id} teamId={team.pg_team_id} slug={slug} />} />
          <Route path="/schedule" element={<Schedule orgId={team.pg_org_id} teamId={team.pg_team_id} />} />
          <Route path="/game/:gameId" element={<GameDetail />} />
          <Route path="/game/:gameId/lineup" element={<LineupSetup />} />
          <Route path="/game/:gameId/score" element={<Scorebook />} />
          <Route path="/game/:gameId/live" element={<LiveScoreboard />} />
          <Route path="/tournament/:eventId/pitching" element={<PitchingReport />} />
          <Route path="/tournament/:eventId/schedule" element={<TournamentSchedule />} />
          <Route path="/tournament/:eventId/bracket" element={<TournamentBracket />} />
          <Route path="/search" element={<TeamSearch />} />
          <Route path="/members" element={<TeamMembers orgId={team.pg_org_id} teamId={team.pg_team_id} />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t-2 px-2 pb-[env(safe-area-inset-bottom)] sticky bottom-0 z-50" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-around max-w-md mx-auto">
          {navItems.map(item => {
            const active = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-2.5 px-4 no-underline transition-colors ${
                  active ? 'nav-active' : 'text-[var(--navy-muted)] opacity-50'
                }`}
              >
                <Icon active={active} />
                <span className="text-[10px] font-semibold mt-1 tracking-wide uppercase">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

// Nav icons
function HomeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'var(--gold-dark)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-8 9 8" /><path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
    </svg>
  )
}

function CalendarIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'var(--gold-dark)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  )
}

function SearchIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'var(--gold-dark)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function MembersIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'var(--gold-dark)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

export default App
