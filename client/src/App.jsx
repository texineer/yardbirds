import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom'
import { getConfig } from './api'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import GameDetail from './pages/GameDetail'
import PitchingReport from './pages/PitchingReport'
import TeamSearch from './pages/TeamSearch'
import TournamentSchedule from './pages/TournamentSchedule'
import TournamentBracket from './pages/TournamentBracket'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const location = useLocation()
  const [config, setConfig] = useState(null)

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setConfig({ orgId: 50903, teamId: 276649, teamName: 'Yardbirds' }))
  }, [])

  const navItems = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/schedule', label: 'Schedule', icon: CalendarIcon },
    { path: '/search', label: 'Teams', icon: SearchIcon },
  ]

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="relative overflow-hidden" style={{ background: 'var(--navy)' }}>
        <div className="relative px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src={config?.teamLogo || '/yardbirds-logo.png'} alt="" className="w-9 h-9 object-contain" />
            <div>
              <span className="font-display text-xl text-white tracking-wide leading-none">{(config?.teamName || 'YARDBIRDS').toUpperCase()}</span>
              <span className="block text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--gold)' }}>PG + Five Tool</span>
            </div>
          </Link>
        </div>
        <div className="stitch-line" />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        {!config ? <LoadingSpinner /> : (
        <Routes>
          <Route path="/" element={<Dashboard orgId={config.orgId} teamId={config.teamId} />} />
          <Route path="/schedule" element={<Schedule orgId={config.orgId} teamId={config.teamId} />} />
          <Route path="/game/:gameId" element={<GameDetail />} />
          <Route path="/tournament/:eventId/pitching" element={<PitchingReport />} />
          <Route path="/tournament/:eventId/schedule" element={<TournamentSchedule />} />
          <Route path="/tournament/:eventId/bracket" element={<TournamentBracket />} />
          <Route path="/search" element={<TeamSearch />} />
          <Route path="/team/:orgId/:teamId" element={<DynamicDashboard />} />
          <Route path="/team/:orgId/:teamId/schedule" element={<DynamicSchedule />} />
        </Routes>
        )}
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
    </div>
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

// Dynamic route wrappers
function DynamicDashboard() {
  const { orgId, teamId } = useParams()
  return <Dashboard orgId={parseInt(orgId)} teamId={parseInt(teamId)} />
}

function DynamicSchedule() {
  const { orgId, teamId } = useParams()
  return <Schedule orgId={parseInt(orgId)} teamId={parseInt(teamId)} />
}

export default App
