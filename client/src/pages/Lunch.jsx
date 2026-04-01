import { useState } from 'react'

const CUISINES = [
  { label: 'Any',       query: 'restaurants' },
  { label: 'Burgers',   query: 'burger restaurants' },
  { label: 'Pizza',     query: 'pizza' },
  { label: 'Mexican',   query: 'mexican food' },
  { label: 'Chinese',   query: 'chinese food' },
  { label: 'Subs',      query: 'sandwich shop' },
  { label: 'BBQ',       query: 'BBQ restaurant' },
  { label: 'Thai',      query: 'thai food' },
  { label: 'Wings',     query: 'chicken wings' },
  { label: 'Breakfast', query: 'breakfast restaurant' },
  { label: 'Italian',   query: 'italian restaurant' },
  { label: 'Sushi',     query: 'sushi' },
]

export default function Lunch() {
  const [loc, setLoc] = useState(null)         // { lat, lng }
  const [locError, setLocError] = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  const [cuisine, setCuisine] = useState(CUISINES[0])
  const [openNow, setOpenNow] = useState(true)

  function getLocation() {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.')
      return
    }
    setLocLoading(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocLoading(false)
      },
      err => {
        setLocError('Could not get your location. Please allow location access and try again.')
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function openMaps() {
    if (!loc) return
    const q = openNow ? `${cuisine.query} open now` : cuisine.query
    // zoom 13 ≈ 5-mile radius on mobile
    const url = `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${loc.lat},${loc.lng},13z`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ background: 'var(--navy)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍔</span>
            <div>
              <div className="font-display text-xl text-white tracking-wider">LUNCH RUN</div>
              <div className="text-[10px] text-white/50 mt-0.5">Find food near the field</div>
            </div>
          </div>
        </div>
        <div className="stitch-line" />
      </div>

      {/* Location */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold" style={{ color: 'var(--navy)' }}>Your Location</div>
          {loc && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
              GPS acquired ✓
            </span>
          )}
        </div>

        {!loc ? (
          <button
            onClick={getLocation}
            disabled={locLoading}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--navy)', color: 'white' }}
          >
            {locLoading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Getting location...
              </>
            ) : (
              <>📍 Use My Location</>
            )}
          </button>
        ) : (
          <button
            onClick={getLocation}
            className="text-[11px] font-semibold"
            style={{ color: 'var(--navy-muted)' }}
          >
            📍 {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} — tap to refresh
          </button>
        )}

        {locError && (
          <p className="text-xs text-red-500">{locError}</p>
        )}
      </div>

      {/* Cuisine picker */}
      <div className="card p-4 space-y-3">
        <div className="text-sm font-bold" style={{ color: 'var(--navy)' }}>What are you craving?</div>
        <div className="grid grid-cols-3 gap-2">
          {CUISINES.map(c => (
            <button
              key={c.label}
              onClick={() => setCuisine(c)}
              className="py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-colors active:scale-95"
              style={{
                background: cuisine.label === c.label ? 'var(--navy)' : 'var(--powder-pale)',
                color: cuisine.label === c.label ? 'white' : 'var(--navy-muted)',
                border: cuisine.label === c.label ? '2px solid var(--navy)' : '2px solid transparent',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Open now toggle */}
      <div className="card p-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--navy)' }}>Open now only</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--navy-muted)' }}>Filter to places open right now</div>
          </div>
          <div
            onClick={() => setOpenNow(v => !v)}
            className="relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0"
            style={{ background: openNow ? 'var(--navy)' : 'var(--border)' }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: openNow ? 'translateX(20px)' : 'translateX(2px)' }}
            />
          </div>
        </label>
      </div>

      {/* Search button */}
      <button
        onClick={loc ? openMaps : getLocation}
        className="w-full py-4 rounded-2xl font-display text-lg tracking-wider transition-colors active:scale-95 disabled:opacity-40"
        style={{ background: 'var(--gold)', color: 'var(--navy)' }}
      >
        {loc ? `🗺 Find ${cuisine.label === 'Any' ? 'Food' : cuisine.label} Near Me` : '📍 Get My Location First'}
      </button>

      <p className="text-center text-[10px]" style={{ color: 'var(--navy-muted)' }}>
        Opens Google Maps • 5-mile radius
      </p>
    </div>
  )
}
