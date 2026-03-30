import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

const PG_BASE = 'https://www.perfectgame.org'

export default function TournamentBracket() {
  const { eventId } = useParams()
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tournaments/${eventId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setTournament)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [eventId])

  const eventUrl = `${PG_BASE}/events/Default.aspx?event=${eventId}`

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <Link to="../schedule" className="inline-flex items-center gap-1 text-xs font-semibold no-underline" style={{ color: 'var(--navy-muted)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Schedule
      </Link>

      <div>
        <h1 className="font-display text-3xl" style={{ color: 'var(--navy)' }}>BRACKET</h1>
        {tournament && (
          <p className="text-sm mt-1" style={{ color: 'var(--navy-muted)' }}>{tournament.name}</p>
        )}
      </div>

      <p className="text-sm" style={{ color: 'var(--navy-muted)' }}>
        Perfect Game renders brackets dynamically in the browser. Tap below to view them on the PG site.
      </p>

      {/* Bracket link */}
      <a
        href={eventUrl}
        target="_blank"
        rel="noopener"
        className="card block no-underline p-5 transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gold)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4v6h4M4 7h8v5M20 4v6h-4M20 7h-8v5M8 17v3h8v-3"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold" style={{ color: 'var(--navy)' }}>Tournament Bracket</div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--navy-muted)' }}>Tap "Brackets" on the PG event page</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
            Open
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
          </div>
        </div>
      </a>

      {/* Pool standings link */}
      <a
        href={eventUrl}
        target="_blank"
        rel="noopener"
        className="card block no-underline p-5 transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--powder-pale)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold" style={{ color: 'var(--navy)' }}>Pool Standings</div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--navy-muted)' }}>Tap "Pool Standings" on the PG event page</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>
            Open
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
          </div>
        </div>
      </a>
    </div>
  )
}
