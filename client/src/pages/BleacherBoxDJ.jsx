import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSoundboard, saveSoundboardButton, getPlaylist, addPlaylistSong, updatePlaylistSong, removePlaylistSong } from '../api'
import { getTeamBySlug } from '../api'
import { useParams } from 'react-router-dom'
import WalkupSongManager from '../components/WalkupSongManager'
import LoadingSpinner from '../components/LoadingSpinner'

export default function BleacherBoxDJ() {
  const { slug } = useParams()
  const { user, hasTeamRole } = useAuth()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [soundboard, setSoundboard] = useState([])
  const [playlist, setPlaylist] = useState([])
  const [editingSoundboard, setEditingSoundboard] = useState(false)
  const [playingKey, setPlayingKey] = useState(null)
  const [playingPlaylistId, setPlayingPlaylistId] = useState(null)
  const [showSoundboard, setShowSoundboard] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const iframeRef = useRef(null)
  const stopTimerRef = useRef(null)
  const ytPlayerRef = useRef(null)
  const ytContainerRef = useRef(null)
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => {
    getTeamBySlug(slug)
      .then(t => {
        setTeam(t)
        if (t) {
          Promise.all([
            getSoundboard(t.pg_org_id, t.pg_team_id),
            getPlaylist(t.pg_org_id, t.pg_team_id),
          ]).then(([sb, pl]) => {
            setSoundboard(sb)
            setPlaylist(pl)
          }).catch(() => {})
        }
      })
      .catch(() => setTeam(null))
      .finally(() => setLoading(false))
  }, [slug])

  const canEdit = user && team && hasTeamRole(team.pg_org_id, team.pg_team_id, ['admin', 'scorekeeper'])

  function stopAll() {
    clearTimeout(stopTimerRef.current)
    if (iframeRef.current) iframeRef.current.src = ''
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo(); ytPlayerRef.current.destroy() } catch (e) {}
      ytPlayerRef.current = null
    }
    if (ytContainerRef.current) ytContainerRef.current.innerHTML = ''
    setPlayingKey(null)
    setPlayingPlaylistId(null)
  }

  function ensureYTApi() {
    return new Promise(resolve => {
      if (window.YT?.Player) { resolve(); return }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      const check = setInterval(() => {
        if (window.YT?.Player) { clearInterval(check); resolve() }
      }, 100)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
    })
  }

  async function playClip(videoId, startSeconds, endSeconds, key, playlistId) {
    stopAll()
    if (!videoId) return
    if (key) setPlayingKey(key)
    if (playlistId) setPlayingPlaylistId(playlistId)
    const duration = (endSeconds - startSeconds) * 1000

    if (isIOS) {
      // iOS: use YT IFrame Player API for reliable playback
      await ensureYTApi()
      if (!ytContainerRef.current) return
      ytContainerRef.current.innerHTML = '<div id="yt-dj-player"></div>'
      ytPlayerRef.current = new window.YT.Player('yt-dj-player', {
        height: '1', width: '1', videoId,
        playerVars: { autoplay: 1, start: Math.floor(startSeconds), playsinline: 1, controls: 0 },
        events: { onReady: (e) => { e.target.setVolume(100); e.target.playVideo() } },
      })
    } else {
      const src = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startSeconds)}&end=${Math.floor(endSeconds)}&autoplay=1&enablejsapi=1&playsinline=1`
      iframeRef.current.src = src
    }
    stopTimerRef.current = setTimeout(stopAll, duration)
  }

  function handleSoundboardTap(btn) {
    if (playingKey === btn.button_key) { stopAll(); return }
    if (!btn.youtube_video_id) return
    playClip(btn.youtube_video_id, btn.start_seconds ?? btn.suggestedStart ?? 0, btn.end_seconds ?? btn.suggestedEnd ?? 20, btn.button_key, null)
  }

  function handlePlaylistTap(song) {
    if (playingPlaylistId === song.id) { stopAll(); return }
    if (!song.youtube_video_id) return
    playClip(song.youtube_video_id, song.start_seconds, song.end_seconds, null, song.id)
  }

  if (loading) return <LoadingSpinner />
  if (!team) return (
    <div className="text-center py-12">
      <div className="font-display text-xl" style={{ color: 'var(--navy-muted)' }}>TEAM NOT FOUND</div>
    </div>
  )

  const configuredCount = soundboard.filter(b => !!b.youtube_video_id).length

  return (
    <div className="space-y-6 pb-8">
      {/* Hidden YouTube iframe (desktop) + YT API container (iOS) */}
      <iframe ref={iframeRef} src="" allow="autoplay" className="hidden" title="dj-player" />
      <div ref={ytContainerRef} className="hidden" />

      {/* Header */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ background: 'var(--navy)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎵</span>
            <div>
              <div className="font-display text-xl text-white tracking-wider">BLEACHERBOX DJ</div>
              <div className="text-[10px] text-white/50 mt-0.5">{team.name}</div>
            </div>
          </div>
        </div>
        <div className="stitch-line" />
      </div>

      {/* ── SOUNDBOARD ── */}
      <section>
        <button
          className="flex items-center justify-between w-full mb-2"
          onClick={() => { setShowSoundboard(s => !s); if (showSoundboard) setEditingSoundboard(false) }}
        >
          <div className="section-label">SOUNDBOARD</div>
          <div className="flex items-center gap-2">
            {!showSoundboard && (
              <span className="text-[10px]" style={{ color: 'var(--navy-muted)' }}>
                {configuredCount}/{soundboard.length} ready
              </span>
            )}
            <span className="text-[11px] font-bold" style={{ color: 'var(--navy-muted)' }}>
              {showSoundboard ? '▲' : '▼'}
            </span>
          </div>
        </button>

        {showSoundboard && (
          <>
            {canEdit && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setEditingSoundboard(e => !e)}
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
                  style={{ background: editingSoundboard ? 'var(--gold)' : 'var(--powder-pale)', color: 'var(--navy)' }}
                >
                  {editingSoundboard ? 'Done' : 'Edit'}
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {soundboard.map(btn => (
                <SoundboardButton
                  key={btn.button_key}
                  btn={btn}
                  isPlaying={playingKey === btn.button_key}
                  editing={editingSoundboard}
                  onTap={() => handleSoundboardTap(btn)}
                  onSave={async (url, start, end) => {
                    await saveSoundboardButton(team.pg_org_id, team.pg_team_id, btn.button_key, { youtubeUrl: url, startSeconds: start, endSeconds: end })
                    const updated = await getSoundboard(team.pg_org_id, team.pg_team_id)
                    setSoundboard(updated)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── BETWEEN INNINGS ── */}
      <section>
        <button
          className="flex items-center justify-between w-full mb-2"
          onClick={() => setShowPlaylist(s => !s)}
        >
          <div className="section-label">BETWEEN INNINGS</div>
          <div className="flex items-center gap-2">
            {!showPlaylist && (
              <span className="text-[10px]" style={{ color: 'var(--navy-muted)' }}>
                {playlist.length === 0 ? 'no songs yet' : `${playlist.length} song${playlist.length !== 1 ? 's' : ''}`}
              </span>
            )}
            <span className="text-[11px] font-bold" style={{ color: 'var(--navy-muted)' }}>
              {showPlaylist ? '▲' : '▼'}
            </span>
          </div>
        </button>

        {showPlaylist && (
          <>
            {canEdit && (
              <div className="flex justify-end mb-2">
                <AddPlaylistSongButton
                  onAdd={async data => {
                    await addPlaylistSong(team.pg_org_id, team.pg_team_id, data)
                    const updated = await getPlaylist(team.pg_org_id, team.pg_team_id)
                    setPlaylist(updated)
                  }}
                />
              </div>
            )}

            {playlist.length === 0 ? (
              <div className="card p-4 text-center">
                <div className="text-sm font-semibold mb-1" style={{ color: 'var(--navy-muted)' }}>No songs yet</div>
                {canEdit ? (
                  <p className="text-xs" style={{ color: 'var(--navy-muted)' }}>
                    Tap + Add Song to build your between-innings playlist.<br />
                    Try: Shipping Up to Boston, Zombie Nation, Thunderstruck, Seven Nation Army
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--navy-muted)' }}>Ask an admin to add songs.</p>
                )}
              </div>
            ) : (
              <div className="card overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
                {playlist.map(song => (
                  <PlaylistRow
                    key={song.id}
                    song={song}
                    isPlaying={playingPlaylistId === song.id}
                    canEdit={canEdit}
                    onPlay={() => handlePlaylistTap(song)}
                    onSave={async data => {
                      await updatePlaylistSong(team.pg_org_id, team.pg_team_id, song.id, data)
                      const updated = await getPlaylist(team.pg_org_id, team.pg_team_id)
                      setPlaylist(updated)
                    }}
                    onDelete={async () => {
                      await removePlaylistSong(team.pg_org_id, team.pg_team_id, song.id)
                      const updated = await getPlaylist(team.pg_org_id, team.pg_team_id)
                      setPlaylist(updated)
                      if (playingPlaylistId === song.id) stopAll()
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── WALKUP SONGS ── */}
      <section>
        <div className="section-label mb-2">WALKUP SONGS</div>
        {team.players?.length > 0 ? (
          <div className="card overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {team.players.map((p, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-display text-base flex-shrink-0"
                    style={{ background: 'var(--navy)', color: 'white' }}>
                    {p.number || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: 'var(--navy)' }}>{p.name}</div>
                    {p.position && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--powder-pale)', color: 'var(--navy)' }}>{p.position}</span>
                    )}
                    <WalkupSongManager
                      orgId={team.pg_org_id}
                      teamId={team.pg_team_id}
                      playerName={p.name}
                      playerNumber={p.number}
                      canEdit={canEdit}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-4 text-center">
            <div className="text-sm" style={{ color: 'var(--navy-muted)' }}>No roster data. Sync from the Home page.</div>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Soundboard button ──────────────────────────────────────────────────────

function SoundboardButton({ btn, isPlaying, editing, onTap, onSave }) {
  const defaultUrl = btn.youtube_url || (btn.youtube_video_id ? `https://youtube.com/watch?v=${btn.youtube_video_id}` : '')
  const [url, setUrl] = useState(defaultUrl)
  const [start, setStart] = useState(btn.start_seconds ?? btn.suggestedStart ?? 0)
  const [end, setEnd] = useState(btn.end_seconds ?? btn.suggestedEnd ?? 20)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const configured = !!btn.youtube_video_id

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(url, start, end)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl p-2 border space-y-1.5" style={{ borderColor: 'var(--border)', background: 'var(--powder-pale)' }}>
        <div className="text-center text-lg leading-none">{btn.emoji}</div>
        <div className="text-[10px] font-bold text-center" style={{ color: 'var(--navy)' }}>{btn.label}</div>
        <input
          className="w-full border rounded px-1.5 py-1 text-[10px]"
          style={{ borderColor: 'var(--border)' }}
          placeholder="YouTube URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <div className="flex gap-1 items-center">
          <input type="number" min="0" className="w-12 border rounded px-1 py-0.5 text-[10px] text-center" style={{ borderColor: 'var(--border)' }}
            value={start} onChange={e => setStart(Number(e.target.value))} />
          <span className="text-[9px]" style={{ color: 'var(--navy-muted)' }}>–</span>
          <input type="number" min="1" className="w-12 border rounded px-1 py-0.5 text-[10px] text-center" style={{ borderColor: 'var(--border)' }}
            value={end} onChange={e => setEnd(Number(e.target.value))} />
          <span className="text-[9px]" style={{ color: 'var(--navy-muted)' }}>s</span>
        </div>
        {!url && (
          <div className="text-[9px] leading-tight" style={{ color: 'var(--navy-muted)' }}>{btn.hint}</div>
        )}
        {error && <div className="text-[9px] text-red-500">{error}</div>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-1 rounded text-[10px] font-bold disabled:opacity-50"
          style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
          {saving ? '...' : 'Save'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onTap}
      disabled={!configured}
      className="rounded-xl py-3 px-2 flex flex-col items-center gap-1 transition-colors active:scale-95 disabled:opacity-40"
      style={{
        background: isPlaying ? 'var(--gold)' : configured ? 'var(--navy)' : 'var(--powder-pale)',
        color: isPlaying ? 'var(--navy)' : configured ? 'white' : 'var(--navy-muted)',
        border: isPlaying ? '2px solid var(--gold-dark)' : '2px solid transparent',
      }}
    >
      <span className="text-2xl leading-none">{btn.emoji}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide leading-tight text-center">{btn.label}</span>
      {isPlaying && <span className="text-[9px] opacity-70">▶ playing</span>}
      {!configured && !isPlaying && <span className="text-[9px] opacity-50">not set</span>}
    </button>
  )
}

// ── Playlist row ───────────────────────────────────────────────────────────

function PlaylistRow({ song, isPlaying, canEdit, onPlay, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(song.youtube_url || (song.youtube_video_id ? `https://youtube.com/watch?v=${song.youtube_video_id}` : ''))
  const [title, setTitle] = useState(song.song_title || '')
  const [artist, setArtist] = useState(song.artist_name || '')
  const [start, setStart] = useState(song.start_seconds || 0)
  const [end, setEnd] = useState(song.end_seconds || 180)
  const [saving, setSaving] = useState(false)
  const duration = Math.round(end - start)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ youtubeUrl: url, songTitle: title, artistName: artist, startSeconds: start, endSeconds: end })
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="p-3 space-y-2" style={{ background: 'var(--powder-pale)' }}>
        <div className="flex gap-2">
          <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
            placeholder="Song title" value={title} onChange={e => setTitle(e.target.value)} required />
          <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
            placeholder="Artist" value={artist} onChange={e => setArtist(e.target.value)} />
        </div>
        <input className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
          placeholder="YouTube URL" value={url} onChange={e => setUrl(e.target.value)} />
        <div className="flex gap-2 items-center">
          <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--navy-muted)' }}>Clip</span>
          <input type="number" min="0" className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
            value={start} onChange={e => setStart(Number(e.target.value))} />
          <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>to</span>
          <input type="number" min="1" className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
            value={end} onChange={e => setEnd(Number(e.target.value))} />
          <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>sec</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="btn-gold px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: 'var(--border)', color: 'var(--navy-muted)' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <button
        onClick={onPlay}
        disabled={!song.youtube_video_id}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-30"
        style={{ background: isPlaying ? 'var(--gold)' : 'var(--navy)', color: isPlaying ? 'var(--navy)' : 'white' }}
      >
        {isPlaying ? '■' : '▶'}
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: 'var(--navy)' }}>{song.song_title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {song.artist_name && <span className="text-[10px]" style={{ color: 'var(--navy-muted)' }}>{song.artist_name}</span>}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
            {duration >= 60 ? `${Math.floor(duration / 60)}m${duration % 60 > 0 ? ` ${duration % 60}s` : ''}` : `${duration}s`}
          </span>
          {!song.youtube_video_id && (
            <span className="text-[10px] text-red-400">no URL set</span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
            Edit
          </button>
          <button onClick={() => { if (confirm(`Remove "${song.song_title}"?`)) onDelete() }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded text-red-500">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add playlist song button/form ──────────────────────────────────────────

function AddPlaylistSongButton({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(180)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await onAdd({ youtubeUrl: url, songTitle: title, artistName: artist, startSeconds: start, endSeconds: end })
      setUrl(''); setTitle(''); setArtist(''); setStart(0); setEnd(180)
      setOpen(false)
    } catch {}
    setSaving(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
        style={{ background: 'var(--gold)', color: 'var(--navy)' }}>
        + Add Song
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full mt-2 p-3 rounded-xl border space-y-2"
      style={{ borderColor: 'var(--border)', background: 'var(--powder-pale)' }}>
      <div className="flex gap-2">
        <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
          placeholder="Song title *" value={title} onChange={e => setTitle(e.target.value)} required />
        <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
          placeholder="Artist" value={artist} onChange={e => setArtist(e.target.value)} />
      </div>
      <input className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
        placeholder="YouTube URL" value={url} onChange={e => setUrl(e.target.value)} />
      <div className="flex gap-2 items-center">
        <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--navy-muted)' }}>Clip</span>
        <input type="number" min="0" className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
          value={start} onChange={e => setStart(Number(e.target.value))} />
        <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>to</span>
        <input type="number" min="1" className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
          value={end} onChange={e => setEnd(Number(e.target.value))} />
        <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>sec ({Math.round(end - start)}s)</span>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="btn-gold px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50">
          {saving ? 'Adding...' : 'Add'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-3 py-1.5 rounded text-xs font-semibold"
          style={{ background: 'var(--border)', color: 'var(--navy-muted)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
