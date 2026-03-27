import { useState } from 'react'
import { Link } from 'react-router-dom'
import { searchTeams } from '../api'

export default function TeamSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (query.length < 2) return
    setSearching(true)
    try {
      const teams = await searchTeams(query)
      setResults(teams)
    } catch (err) {
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: 'var(--navy)' }}>FIND A TEAM</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search team name..."
          className="flex-1 rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2"
          style={{
            background: 'var(--cream)',
            border: '2px solid var(--parchment-dark)',
            color: 'var(--navy)',
            '--tw-ring-color': 'var(--gold)',
          }}
        />
        <button
          type="submit"
          disabled={searching || query.length < 2}
          className="btn-primary px-5 py-3 rounded-lg font-bold text-sm disabled:opacity-40"
        >
          {searching ? '...' : 'Search'}
        </button>
      </form>

      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--navy-muted)' }}>
        Search finds previously scraped teams. Load new teams from the dashboard.
      </p>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((t, i) => (
            <Link
              key={`${t.pg_org_id}-${t.pg_team_id}`}
              to={`/team/${t.pg_org_id}/${t.pg_team_id}`}
              className="card-enter block card p-4 no-underline"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="font-semibold" style={{ color: 'var(--navy)' }}>{t.name}</div>
              <div className="flex items-center gap-2 mt-1.5">
                {t.age_group && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--parchment)', color: 'var(--navy)' }}>
                    {t.age_group}
                  </span>
                )}
                {t.classification && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: 'white' }}>
                    {t.classification}
                  </span>
                )}
                {t.hometown && (
                  <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>{t.hometown}</span>
                )}
                {t.record && (
                  <span className="ml-auto font-display text-base" style={{ color: 'var(--navy)' }}>{t.record}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {results.length === 0 && query.length >= 2 && !searching && (
        <div className="text-center py-8">
          <div className="font-display text-base" style={{ color: 'var(--navy-muted)' }}>NO TEAMS FOUND</div>
        </div>
      )}
    </div>
  )
}
