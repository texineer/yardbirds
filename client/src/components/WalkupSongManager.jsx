import { useState, useEffect, useRef } from 'react'
import { getWalkupSong, saveYoutubeWalkup, uploadWalkupSong, deleteWalkupSong } from '../api'

export default function WalkupSongManager({ orgId, teamId, playerName, playerNumber, canEdit }) {
  const [song, setSong] = useState(undefined) // undefined = loading, null = none
  const [mode, setMode] = useState('view') // 'view' | 'youtube' | 'upload'
  const [tab, setTab] = useState('youtube')
  const [saving, setSaving] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  // YouTube form state
  const [ytUrl, setYtUrl] = useState('')
  const [ytTitle, setYtTitle] = useState('')
  const [ytArtist, setYtArtist] = useState('')
  const [ytStart, setYtStart] = useState(0)
  const [ytEnd, setYtEnd] = useState(45)
  const [ytAnnounce, setYtAnnounce] = useState(true)

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null)
  const [upTitle, setUpTitle] = useState('')
  const [upArtist, setUpArtist] = useState('')
  const [upStart, setUpStart] = useState(0)
  const [upEnd, setUpEnd] = useState(45)
  const [upAnnounce, setUpAnnounce] = useState(true)

  const audioRef = useRef(null)
  const announceAudioRef = useRef(null)
  const stopTimerRef = useRef(null)
  const iframeRef = useRef(null)

  useEffect(() => {
    getWalkupSong(orgId, teamId, playerName)
      .then(setSong)
      .catch(() => setSong(null))
  }, [orgId, teamId, playerName])

  function stopPlayback() {
    clearTimeout(stopTimerRef.current)
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    if (announceAudioRef.current) {
      announceAudioRef.current.pause()
      announceAudioRef.current.onended = null
      announceAudioRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (iframeRef.current) iframeRef.current.src = ''
    setPlaying(false)
  }

  function announcePlayer(onDone) {
    if (song?.announce_audio_path) {
      const a = new Audio(`/walkups/${song.announce_audio_path}`)
      announceAudioRef.current = a
      a.onended = onDone
      a.onerror = onDone
      a.play().catch(onDone)
    } else if (window.speechSynthesis) {
      const numStr = playerNumber ? ` number ${playerNumber},` : ''
      const utterance = new SpeechSynthesisUtterance(`Now batting,${numStr} ${playerName}!`)
      utterance.rate = 0.82
      utterance.pitch = 0.75
      utterance.volume = 1
      utterance.onend = onDone
      utterance.onerror = onDone
      window.speechSynthesis.speak(utterance)
    } else {
      onDone()
    }
  }

  function ytSrc(autoplay) {
    return `https://www.youtube.com/embed/${song.youtube_video_id}?start=${Math.floor(song.start_seconds)}&end=${Math.floor(song.end_seconds)}&autoplay=${autoplay}&enablejsapi=1`
  }

  function startClip() {
    if (!song) return
    if (song.song_type === 'upload') {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = song.start_seconds
      audio.play()
      const duration = (song.end_seconds - song.start_seconds) * 1000
      stopTimerRef.current = setTimeout(stopPlayback, duration)
      audio.onended = stopPlayback
    } else {
      if (iframeRef.current) {
        if (iframeRef.current.src?.includes(song.youtube_video_id)) {
          // iframe already loaded (preloaded muted during handlePlay for iOS)
          // Unmute, seek to start, and ensure playing
          const win = iframeRef.current.contentWindow
          const cmd = (func, args = []) => win?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
          cmd('seekTo', [Math.floor(song.start_seconds), true])
          cmd('unMute')
          cmd('setVolume', [100])
          cmd('playVideo')
        } else {
          iframeRef.current.src = ytSrc(1)
        }
      }
      const duration = (song.end_seconds - song.start_seconds) * 1000
      stopTimerRef.current = setTimeout(stopPlayback, duration)
    }
  }

  function handlePlay() {
    if (playing) { stopPlayback(); return }
    if (!song) return
    setPlaying(true)
    if (song.announce) {
      if (song.song_type === 'youtube' && iframeRef.current) {
        // iOS fix: load iframe with autoplay=1 AND mute=1 to "unlock" it
        // during the user gesture. This lets us unmute + seek later after
        // the announcer finishes without iOS blocking playback.
        iframeRef.current.src = `https://www.youtube.com/embed/${song.youtube_video_id}?start=${Math.floor(song.start_seconds)}&end=${Math.floor(song.end_seconds)}&autoplay=1&mute=1&enablejsapi=1`
      }
      announcePlayer(startClip)
    } else {
      startClip()
    }
  }

  async function handleYouTubeSave(e) {
    e.preventDefault()
    if (!ytUrl.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveYoutubeWalkup(orgId, teamId, playerName, {
        youtubeUrl: ytUrl.trim(),
        startSeconds: ytStart,
        endSeconds: ytEnd,
        title: ytTitle.trim() || null,
        artist: ytArtist.trim() || null,
        announce: ytAnnounce,
        playerNumber: playerNumber || null,
      })
      const updated = await getWalkupSong(orgId, teamId, playerName)
      setSong(updated)
      setMode('view')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadSave(e) {
    e.preventDefault()
    if (!uploadFile) return
    setSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('startSeconds', upStart)
      fd.append('endSeconds', upEnd)
      fd.append('announce', upAnnounce ? '1' : '0')
      if (playerNumber) fd.append('playerNumber', playerNumber)
      if (upTitle) fd.append('title', upTitle)
      if (upArtist) fd.append('artist', upArtist)
      await uploadWalkupSong(orgId, teamId, playerName, fd)
      const updated = await getWalkupSong(orgId, teamId, playerName)
      setSong(updated)
      setMode('view')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remove this walkup song?')) return
    stopPlayback()
    try {
      await deleteWalkupSong(orgId, teamId, playerName)
      setSong(null)
      setMode('view')
    } catch (err) {
      setError(err.message)
    }
  }

  function enterSetup() {
    stopPlayback()
    if (song) {
      // Pre-fill form with existing song
      if (song.song_type === 'youtube') {
        setTab('youtube')
        setYtUrl(song.youtube_url || '')
        setYtTitle(song.song_title || '')
        setYtArtist(song.artist_name || '')
        setYtStart(song.start_seconds || 0)
        setYtEnd(song.end_seconds || 45)
        setYtAnnounce(song.announce !== 0)
      } else {
        setTab('upload')
        setUpTitle(song.song_title || '')
        setUpArtist(song.artist_name || '')
        setUpStart(song.start_seconds || 0)
        setUpEnd(song.end_seconds || 45)
        setUpAnnounce(song.announce !== 0)
      }
    }
    setMode('edit')
    setError(null)
  }

  if (song === undefined) return null // still loading

  // ── Edit / Setup mode ──────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          {['youtube', 'upload'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
              style={{
                background: tab === t ? 'var(--powder-pale)' : 'white',
                color: tab === t ? 'var(--navy)' : 'var(--navy-muted)',
                borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
              }}>
              {t === 'youtube' ? '▶ YouTube URL' : '⬆ Upload File'}
            </button>
          ))}
        </div>

        {tab === 'youtube' && (
          <form onSubmit={handleYouTubeSave} className="p-3 space-y-2">
            <input
              className="w-full border rounded px-2 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)' }}
              placeholder="YouTube URL (e.g. https://youtube.com/watch?v=...)"
              value={ytUrl}
              onChange={e => setYtUrl(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
                placeholder="Song title" value={ytTitle} onChange={e => setYtTitle(e.target.value)} />
              <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
                placeholder="Artist" value={ytArtist} onChange={e => setYtArtist(e.target.value)} />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs font-semibold shrink-0" style={{ color: 'var(--navy-muted)' }}>Clip</label>
              <div className="flex items-center gap-1 flex-1">
                <input type="number" min="0" step="1"
                  className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
                  value={ytStart} onChange={e => setYtStart(Number(e.target.value))} />
                <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>to</span>
                <input type="number" min="1" step="1"
                  className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
                  value={ytEnd} onChange={e => setYtEnd(Number(e.target.value))} />
                <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>sec &nbsp;({ytEnd - ytStart}s clip)</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--navy)' }}>
              <input type="checkbox" checked={ytAnnounce} onChange={e => setYtAnnounce(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--gold-dark)]" />
              <span>Announce player name &amp; number</span>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="btn-gold px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => { setMode('view'); setError(null) }}
                className="px-3 py-1.5 rounded text-xs font-semibold"
                style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {tab === 'upload' && (
          <form onSubmit={handleUploadSave} className="p-3 space-y-2">
            <label className="block">
              <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--navy-muted)' }}>
                Audio file (.mp3 or .m4a, max 10MB)
              </span>
              <input type="file" accept=".mp3,.m4a"
                className="text-sm w-full"
                onChange={e => setUploadFile(e.target.files[0] || null)}
                required
              />
            </label>
            <div className="flex gap-2">
              <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
                placeholder="Song title" value={upTitle} onChange={e => setUpTitle(e.target.value)} />
              <input className="flex-1 border rounded px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}
                placeholder="Artist" value={upArtist} onChange={e => setUpArtist(e.target.value)} />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs font-semibold shrink-0" style={{ color: 'var(--navy-muted)' }}>Clip</label>
              <div className="flex items-center gap-1 flex-1">
                <input type="number" min="0" step="1"
                  className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
                  value={upStart} onChange={e => setUpStart(Number(e.target.value))} />
                <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>to</span>
                <input type="number" min="1" step="1"
                  className="w-16 border rounded px-2 py-1 text-sm text-center" style={{ borderColor: 'var(--border)' }}
                  value={upEnd} onChange={e => setUpEnd(Number(e.target.value))} />
                <span className="text-xs" style={{ color: 'var(--navy-muted)' }}>sec &nbsp;({upEnd - upStart}s clip)</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--navy)' }}>
              <input type="checkbox" checked={upAnnounce} onChange={e => setUpAnnounce(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--gold-dark)]" />
              <span>Announce player name &amp; number</span>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="btn-gold px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50">
                {saving ? 'Uploading...' : 'Save'}
              </button>
              <button type="button" onClick={() => { setMode('view'); setError(null) }}
                className="px-3 py-1.5 rounded text-xs font-semibold"
                style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  // ── View / Playback mode ───────────────────────────────────────────────
  return (
    <div className="mt-1.5">
      {song ? (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Play button */}
          <button
            onClick={handlePlay}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors"
            style={{
              background: playing ? 'var(--gold)' : 'var(--powder-pale)',
              color: 'var(--navy)',
            }}
          >
            {playing ? (
              <>
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'var(--navy)' }} />
                Stop
              </>
            ) : (
              <>▶ {song.song_title || 'Walkup Song'}</>
            )}
          </button>

          {/* Artist + clip info */}
          {(song.artist_name || song.song_type) && (
            <span className="text-[10px]" style={{ color: 'var(--navy-muted)' }}>
              {song.artist_name && `${song.artist_name} · `}
              {song.end_seconds - song.start_seconds}s clip
              {song.song_type === 'youtube' ? ' · YouTube' : ''}
            </span>
          )}

          {/* Edit / Delete — admins and scorekeepers only */}
          {canEdit && (
            <>
              <button onClick={enterSetup}
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
                Edit
              </button>
              <button onClick={handleDelete}
                className="text-[10px] font-semibold px-2 py-0.5 rounded text-red-500">
                Remove
              </button>
            </>
          )}

          {/* Hidden audio element for uploaded files */}
          {song.song_type === 'upload' && (
            <audio ref={audioRef} src={`/walkups/${song.file_path}`} preload="none" />
          )}

          {/* Hidden YouTube iframe */}
          {song.song_type === 'youtube' && (
            <iframe
              ref={iframeRef}
              src=""
              allow="autoplay"
              className="hidden"
              title="walkup"
            />
          )}
        </div>
      ) : (
        canEdit && (
          <button onClick={enterSetup}
            className="text-[10px] font-semibold px-2 py-1 rounded"
            style={{ background: 'var(--powder-pale)', color: 'var(--navy-muted)' }}>
            + Add walkup song
          </button>
        )
      )}
    </div>
  )
}
