import { useState, useRef, useEffect } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getTeam } from '../api'

const CARD_W = 500
const CARD_H = 700

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

async function drawCard(canvas, { photoBlob, playerName, playerNumber, playerPosition, teamName, logoUrl, useFilter }) {
  if (!canvas || !photoBlob) return

  await document.fonts.ready

  const ctx = canvas.getContext('2d')
  canvas.width = CARD_W
  canvas.height = CARD_H

  const gold = cssVar('--gold') || '#C9A84C'
  const navy = cssVar('--navy') || '#1B2B4B'
  const year = new Date().getFullYear()

  // Background
  ctx.fillStyle = navy
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Outer gold border
  ctx.strokeStyle = gold
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, CARD_W - 10, CARD_H - 10)

  // Inner thin gold border
  ctx.lineWidth = 2
  ctx.strokeRect(15, 15, CARD_W - 30, CARD_H - 30)

  // Team name banner area (above photo)
  const bannerH = 36
  const bannerY = 20
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(20, bannerY, CARD_W - 40, bannerH)

  ctx.fillStyle = gold
  ctx.font = 'bold 14px "DM Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '4px'
  ctx.fillText(`${teamName.toUpperCase()}  ${year}`, CARD_W / 2, bannerY + bannerH / 2)

  // Photo area
  const photoX = 20
  const photoY = bannerY + bannerH + 4
  const photoW = CARD_W - 40
  const photoH = Math.round(CARD_H * 0.52)

  // Load and draw photo
  await new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // Cover-fill the photo area
      const srcRatio = img.width / img.height
      const dstRatio = photoW / photoH
      let sx = 0, sy = 0, sw = img.width, sh = img.height
      if (srcRatio > dstRatio) {
        sw = Math.round(img.height * dstRatio)
        sx = Math.round((img.width - sw) / 2)
      } else {
        sh = Math.round(img.width / dstRatio)
        sy = Math.round((img.height - sh) / 2)
      }

      if (useFilter) {
        ctx.filter = 'sepia(0.35) contrast(1.2) brightness(1.04)'
      }
      ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH)
      ctx.filter = 'none'

      // Vignette on photo
      if (useFilter) {
        const vig = ctx.createRadialGradient(
          CARD_W / 2, photoY + photoH / 2, photoH * 0.18,
          CARD_W / 2, photoY + photoH / 2, photoH * 0.72
        )
        vig.addColorStop(0, 'rgba(0,0,0,0)')
        vig.addColorStop(1, 'rgba(0,0,0,0.5)')
        ctx.fillStyle = vig
        ctx.fillRect(photoX, photoY, photoW, photoH)
      }

      resolve()
    }
    img.onerror = resolve
    img.src = URL.createObjectURL(photoBlob)
  })

  // Thick gold divider
  const divY = photoY + photoH + 6
  ctx.fillStyle = gold
  ctx.fillRect(20, divY, CARD_W - 40, 5)

  // Bottom info panel
  const panelY = divY + 14

  // Player name
  ctx.font = `bold 60px "Bebas Neue", sans-serif`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.letterSpacing = '2px'
  // Truncate long names
  let nameFontSize = 60
  ctx.font = `bold ${nameFontSize}px "Bebas Neue", sans-serif`
  while (ctx.measureText(playerName.toUpperCase()).width > CARD_W - 80 && nameFontSize > 30) {
    nameFontSize -= 4
    ctx.font = `bold ${nameFontSize}px "Bebas Neue", sans-serif`
  }
  ctx.fillText(playerName.toUpperCase(), 26, panelY)

  // Jersey number (right-aligned, gold)
  if (playerNumber) {
    ctx.font = `bold 44px "Bebas Neue", sans-serif`
    ctx.fillStyle = gold
    ctx.textAlign = 'right'
    ctx.fillText(`#${playerNumber}`, CARD_W - 26, panelY + 6)
  }

  // Position
  if (playerPosition) {
    ctx.font = `bold 26px "Bebas Neue", sans-serif`
    ctx.fillStyle = gold
    ctx.textAlign = 'left'
    ctx.letterSpacing = '5px'
    ctx.fillText(playerPosition.toUpperCase(), 26, panelY + nameFontSize + 2)
  }

  // Thin gold bottom accent line
  ctx.fillStyle = gold
  ctx.fillRect(20, CARD_H - 32, CARD_W - 40, 2)

  // BleacherBox watermark
  ctx.font = '11px "DM Sans", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.letterSpacing = '0px'
  ctx.fillText('BleacherBox', CARD_W - 24, CARD_H - 12)

  // Team logo (bottom left)
  if (logoUrl) {
    await new Promise((resolve) => {
      const logo = new Image()
      logo.crossOrigin = 'anonymous'
      logo.onload = () => {
        ctx.drawImage(logo, 24, CARD_H - 54, 36, 36)
        resolve()
      }
      logo.onerror = resolve
      logo.src = logoUrl
    })
  }
}

export default function BaseballCard({ orgId, teamId }) {
  const [team, setTeam] = useState(null)
  const [step, setStep] = useState(1)
  const [playerName, setPlayerName] = useState('')
  const [playerNumber, setPlayerNumber] = useState('')
  const [playerPosition, setPlayerPosition] = useState('')
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const [croppedBlob, setCroppedBlob] = useState(null)
  const [useFilter, setUseFilter] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedCardUrl, setSavedCardUrl] = useState(null)
  const imgRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    getTeam(orgId, teamId).then(setTeam).catch(() => {})
  }, [orgId, teamId])

  // Re-render card when filter toggles
  useEffect(() => {
    if (step === 3 && croppedBlob && canvasRef.current) {
      drawCard(canvasRef.current, {
        photoBlob: croppedBlob,
        playerName,
        playerNumber,
        playerPosition,
        teamName: team?.name || '',
        logoUrl: team?.logo_url || null,
        useFilter,
      })
    }
  }, [useFilter, step, croppedBlob])

  function onSelectFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImgSrc(reader.result?.toString() || '')
      setStep(2)
    })
    reader.readAsDataURL(file)
  }

  function onImageLoad(e) {
    const { width, height } = e.currentTarget
    const c = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 5 / 7, width, height), width, height)
    setCrop(c)
  }

  function getCroppedBlob() {
    return new Promise((resolve) => {
      if (!completedCrop || !imgRef.current) return resolve(null)
      const canvas = document.createElement('canvas')
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height
      canvas.width = Math.round(completedCrop.width * scaleX)
      canvas.height = Math.round(completedCrop.height * scaleY)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX, completedCrop.y * scaleY,
        completedCrop.width * scaleX, completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height
      )
      canvas.toBlob(resolve, 'image/png')
    })
  }

  async function handlePreview() {
    const blob = await getCroppedBlob()
    if (!blob) return
    setCroppedBlob(blob)
    setStep(3)
    // Canvas renders via useEffect above after state settles,
    // but trigger immediately too
    requestAnimationFrame(() => {
      if (canvasRef.current) {
        drawCard(canvasRef.current, {
          photoBlob: blob,
          playerName,
          playerNumber,
          playerPosition,
          teamName: team?.name || '',
          logoUrl: team?.logo_url || null,
          useFilter,
        })
      }
    })
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(playerName || 'player').toLowerCase().replace(/\s+/g, '-')}-baseball-card.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  async function handleSave() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const fd = new FormData()
      fd.append('file', blob, 'card.png')
      const res = await fetch(
        `/api/teams/${orgId}/${teamId}/players/${encodeURIComponent(playerName)}/baseball-card`,
        { method: 'POST', credentials: 'include', body: fd }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setSavedCardUrl(data.cardUrl)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  function resetAll() {
    setStep(1)
    setImgSrc('')
    setCroppedBlob(null)
    setSavedCardUrl(null)
    setPlayerName('')
    setPlayerNumber('')
    setPlayerPosition('')
  }

  return (
    <div className="py-2">
      <div className="section-label mb-4">Baseball Card</div>

      {/* Step 1: Player info + photo upload */}
      {step === 1 && (
        <div className="card p-4 space-y-4">
          <p className="text-sm" style={{ color: 'var(--navy-muted)' }}>
            Pick a player from your roster, then upload their photo to create a collectible baseball card.
          </p>

          {team?.players?.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--navy-muted)' }}>
                Quick fill from roster
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--navy)' }}
                value=""
                onChange={e => {
                  const p = team.players.find(pl => pl.name === e.target.value)
                  if (p) {
                    setPlayerName(p.name || '')
                    setPlayerNumber(p.number || '')
                    setPlayerPosition(p.position || '')
                  }
                }}
              >
                <option value="">— Select a player —</option>
                {team.players.map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name}{p.number ? ` #${p.number}` : ''}{p.position ? ` · ${p.position}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--navy-muted)' }}>Name</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--navy)' }}
                placeholder="Player Name"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--navy-muted)' }}>Position</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--navy)' }}
                value={playerPosition}
                onChange={e => setPlayerPosition(e.target.value)}
              >
                <option value="">—</option>
                {['P','C','1B','2B','3B','SS','LF','CF','RF','DH','OF','INF','UTL'].map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--navy-muted)'}}># Jersey</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--navy)' }}
                placeholder="12"
                value={playerNumber}
                onChange={e => setPlayerNumber(e.target.value)}
              />
            </div>
          </div>

          <label className={`btn-gold block text-center cursor-pointer${!playerName.trim() ? ' opacity-40 pointer-events-none' : ''}`}>
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={onSelectFile} disabled={!playerName.trim()} />
          </label>
        </div>
      )}

      {/* Step 2: Crop */}
      {step === 2 && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="text-xs font-semibold" style={{ color: 'var(--gold-dark)' }}>← Back</button>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--navy-muted)' }}>Crop Photo</span>
            <span className="text-xs opacity-0">Back</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--navy-muted)' }}>
            Drag and resize the crop area. Card ratio is locked at portrait 5:7.
          </p>
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, pct) => setCrop(pct)}
              onComplete={c => setCompletedCrop(c)}
              aspect={5 / 7}
              minWidth={80}
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imgSrc}
                style={{ maxHeight: '60vh', maxWidth: '100%', display: 'block' }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          )}
          <button
            className="btn-gold w-full"
            disabled={!completedCrop?.width}
            onClick={handlePreview}
          >
            Preview Card →
          </button>
        </div>
      )}

      {/* Step 3: Preview + actions */}
      {step === 3 && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="text-xs font-semibold" style={{ color: 'var(--gold-dark)' }}>← Recrop</button>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--navy-muted)' }}>{playerName}</span>
            <span className="text-xs opacity-0">x</span>
          </div>

          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            />
          </div>

          {/* Vintage filter toggle */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>Vintage Filter</span>
            <button
              onClick={() => setUseFilter(f => !f)}
              className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: useFilter ? 'var(--gold)' : 'var(--border)' }}
              aria-label="Toggle vintage filter"
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${useFilter ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="btn-gold" onClick={handleDownload}>
              Download PNG
            </button>
            <button
              className="btn-gold"
              onClick={handleSave}
              disabled={saving || !!savedCardUrl}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : savedCardUrl ? 'Saved ✓' : 'Save to Profile'}
            </button>
          </div>

          <button
            className="w-full text-center text-xs font-semibold py-1"
            style={{ color: 'var(--gold-dark)' }}
            onClick={resetAll}
          >
            Make another card
          </button>
        </div>
      )}
    </div>
  )
}
