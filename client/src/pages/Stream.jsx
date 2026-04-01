import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API = '/api'

export default function Stream({ orgId, teamId }) {
  const { hasTeamRole, user } = useAuth()
  const isAdmin = user && hasTeamRole(orgId, teamId, ['admin'])

  const [config, setConfig] = useState({ youtube_url: '', is_live: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editUrl, setEditUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API}/teams/${orgId}/${teamId}/stream`)
      .then(r => r.json())
      .then(data => {
        setConfig(data)
        setEditUrl(data.youtube_url || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId, teamId])

  async function saveConfig(updates) {
    setSaving(true)
    try {
      const res = await fetch(`${API}/teams/${orgId}/${teamId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, ...updates }),
      })
      const data = await res.json()
      setConfig(data)
      setEditUrl(data.youtube_url || '')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(config.youtube_url || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: config.is_live ? '#ef4444' : 'var(--navy)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
        <div>
          <h1 className="font-display text-xl tracking-wide" style={{ color: 'var(--navy)' }}>LIVE STREAM</h1>
          {config.is_live
            ? <span className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                Live Now
              </span>
            : <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>Not streaming</span>
          }
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="rounded-xl p-4 space-y-4 border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--navy-muted)' }}>Admin Controls</p>

          {/* YouTube URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>YouTube Live URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                placeholder="https://youtube.com/live/..."
                className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)', background: 'white', '--tw-ring-color': 'var(--gold)' }}
              />
              <button
                onClick={() => saveConfig({ youtube_url: editUrl })}
                disabled={saving || editUrl === (config.youtube_url || '')}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-opacity disabled:opacity-40"
                style={{ background: 'var(--navy)', color: 'white' }}>
                Save
              </button>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--navy-muted)' }}>
              Paste the share URL from YouTube Studio after going live
            </p>
          </div>

          {/* Live toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>We're Live</p>
              <p className="text-xs" style={{ color: 'var(--navy-muted)' }}>Shows a live badge to parents</p>
            </div>
            <button
              onClick={() => saveConfig({ is_live: !config.is_live })}
              disabled={saving || !config.youtube_url}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-40 ${
                config.is_live ? 'bg-red-500' : ''
              }`}
              style={!config.is_live ? { background: 'var(--border)' } : {}}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                config.is_live ? 'left-6.5' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Watch Card */}
      {config.youtube_url ? (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {/* YouTube thumbnail */}
          <div className="relative" style={{ background: 'var(--navy)' }}>
            <a
              href={config.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-3 py-10 no-underline">
              {config.is_live && (
                <span className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                  Live
                </span>
              )}
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white">Watch on YouTube</span>
            </a>
          </div>

          {/* Share row */}
          <div className="flex border-t" style={{ borderColor: 'var(--border)' }}>
            <a
              href={config.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold no-underline transition-opacity active:opacity-70"
              style={{ color: 'var(--navy)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
              Open
            </a>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-opacity active:opacity-70"
              style={{ color: copied ? '#22c55e' : 'var(--navy)' }}>
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-8 flex flex-col items-center gap-3 text-center border" style={{ borderColor: 'var(--border)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-30" style={{ background: 'var(--navy)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm font-semibold opacity-40" style={{ color: 'var(--navy)' }}>No stream configured yet</p>
          {!isAdmin && (
            <p className="text-xs opacity-30" style={{ color: 'var(--navy)' }}>Ask your team admin to set up the stream link</p>
          )}
        </div>
      )}

      {/* Info section */}
      <div className="rounded-xl p-4 space-y-2 border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--navy-muted)' }}>About BleacherBox Live</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--navy-muted)' }}>
          Stream your game to YouTube with AI-powered overlays — player tracking, ball trail, and strike zone detection.
          Powered by YOLOv8 on a local Mac Mini at the field.
        </p>
      </div>
    </div>
  )
}
