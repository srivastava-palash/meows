'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { UploadResult } from '@/types'
import { useCity } from '@/context/CityContext'

// LocationPicker must be client-only (Leaflet needs window)
const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, borderRadius: 12, background: '#e8ead8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: '#888' }}>Loading map…</span>
    </div>
  ),
})

type Step = 1 | 2 | 3

interface PersistedState {
  step: Step
  upload: UploadResult | null
  additionalUploads: UploadResult[]   // extra photos already uploaded
  lat: number
  lng: number
  locationName: string | null
  name: string
  story: string
}

const SESSION_KEY = 'meows-add-cat-draft'
const MUMBAI = { lat: 19.076, lng: 72.8777 }  // fallback only
const MAX_EXTRA = 4   // up to 4 additional photos (5 total)

function loadDraft(fallbackCenter: { lat: number; lng: number }): PersistedState {
  if (typeof window === 'undefined') return defaultDraft(fallbackCenter)
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState
      return {
        ...parsed,
        lat: parsed.lat ?? fallbackCenter.lat,
        lng: parsed.lng ?? fallbackCenter.lng,
        additionalUploads: parsed.additionalUploads ?? [],
      }
    }
  } catch {}
  return defaultDraft(fallbackCenter)
}

function defaultDraft(center = MUMBAI): PersistedState {
  return { step: 1, upload: null, additionalUploads: [], lat: center.lat, lng: center.lng, locationName: null, name: '', story: '' }
}

function saveDraft(s: PersistedState) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {}
}

function clearDraft() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
    const d = await r.json()
    return d.address?.suburb ?? d.address?.neighbourhood ?? d.address?.city_district ?? d.address?.city ?? null
  } catch { return null }
}

// ── NSFW guard ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nsfwModel: any = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function checkNsfw(objectUrl: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js')
    await loadScript('https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/nsfwjs.min.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nsfwjs = (window as any).nsfwjs
    if (!nsfwjs) throw new Error('nsfwjs not available')
    if (!nsfwModel) nsfwModel = await nsfwjs.load()

    const img = new Image()
    img.src = objectUrl
    await img.decode()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const predictions: { className: string; probability: number }[] = await nsfwModel.classify(img)
    const get = (cls: string) => predictions.find(p => p.className === cls)?.probability ?? 0
    if (get('Porn') > 0.55 || get('Hentai') > 0.55 || get('Sexy') > 0.75) {
      return { safe: false, reason: '🚫 This image looks inappropriate. Please use a photo of a cat or animal.' }
    }
    return { safe: true }
  } catch (e) {
    console.warn('NSFW check skipped (CDN unavailable):', e)
    return { safe: true }
  }
}

export default function AddCatForm() {
  const router = useRouter()
  const { mapCenter } = useCity()

  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extraPhotos, setExtraPhotos] = useState<File[]>([])
  const [extraPreviews, setExtraPreviews] = useState<string[]>([])
  const [draft, setDraftRaw] = useState<PersistedState>(defaultDraft)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'done' | 'unavailable'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const extraFileRef = useRef<HTMLInputElement>(null)

  // Hydrate from sessionStorage after mount, seeding position from current map center
  useEffect(() => {
    const saved = loadDraft(mapCenter)
    // If no draft exists (fresh form), use current map center as starting location
    setDraftRaw(saved)
    if (saved.upload) setPreview(saved.upload.thumbnail_url)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount — mapCenter at mount time is the seed

  function setDraft(updater: (prev: PersistedState) => PersistedState) {
    setDraftRaw(prev => {
      const next = updater(prev)
      saveDraft(next)
      return next
    })
  }

  function goTo(s: Step) {
    setDraft(prev => ({ ...prev, step: s }))
    setError(null)
  }

  async function handlePinMove(lat: number, lng: number) {
    setDraft(prev => ({ ...prev, lat, lng }))
    const name = await reverseGeocode(lat, lng)
    setDraft(prev => ({ ...prev, locationName: name }))
  }

  async function tryGps() {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return }
    if (!window.isSecureContext) { setGpsStatus('unavailable'); return }
    setGpsStatus('detecting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const name = await reverseGeocode(lat, lng)
        setDraft(prev => ({ ...prev, lat, lng, locationName: name }))
        setGpsStatus('done')
      },
      () => setGpsStatus('unavailable'),
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  function enterStep2() {
    goTo(2)
    setGpsStatus('idle')
    if (typeof window !== 'undefined' && navigator.geolocation) {
      tryGps()
    } else {
      setGpsStatus('unavailable')
    }
  }

  // Primary photo
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPhoto(file)
    setPreview(url)
    setError(null)
    setChecking(true)
    const { safe, reason } = await checkNsfw(url)
    setChecking(false)
    if (!safe) {
      setError(reason ?? 'Inappropriate image detected.')
      setPhoto(null)
      setPreview(null)
      URL.revokeObjectURL(url)
    }
  }

  // Extra photos (up to MAX_EXTRA)
  async function handleExtraFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const alreadyHave = extraPhotos.length + (draft.additionalUploads?.length ?? 0)
    const slots = MAX_EXTRA - alreadyHave
    const toAdd = files.slice(0, slots)
    // Show previews immediately
    const urls = toAdd.map(f => URL.createObjectURL(f))
    setExtraPhotos(prev => [...prev, ...toAdd])
    setExtraPreviews(prev => [...prev, ...urls])
    // Reset input so same file can be re-added
    e.target.value = ''
  }

  function removeExtraPhoto(i: number) {
    URL.revokeObjectURL(extraPreviews[i])
    setExtraPhotos(prev => prev.filter((_, idx) => idx !== i))
    setExtraPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  function removePersistedExtra(i: number) {
    setDraft(prev => ({
      ...prev,
      additionalUploads: prev.additionalUploads.filter((_, idx) => idx !== i),
    }))
  }

  async function uploadFile(file: File): Promise<UploadResult | null> {
    const fd = new FormData()
    fd.append('photo', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) return null
    return res.json()
  }

  async function handlePhotoNext() {
    if (!photo && !draft.upload) { setError('Please select a photo'); return }
    setLoading(true)
    setError(null)

    // Upload primary if new file selected
    let primaryUpload = draft.upload
    if (photo) {
      const result = await uploadFile(photo)
      if (!result) { setLoading(false); setError('Upload failed. Try again.'); return }
      primaryUpload = result
      setDraft(prev => ({ ...prev, upload: result }))
    }

    // Upload any pending extra photos
    if (extraPhotos.length > 0) {
      const results: UploadResult[] = []
      for (const file of extraPhotos) {
        const result = await uploadFile(file)
        if (result) results.push(result)
      }
      setDraft(prev => ({
        ...prev,
        additionalUploads: [...(prev.additionalUploads ?? []), ...results],
      }))
      setExtraPhotos([])
      setExtraPreviews(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return [] })
    }

    setLoading(false)
    if (primaryUpload) enterStep2()
  }

  async function handleSubmit() {
    if (!draft.upload) { setError('Photo upload missing'); return }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/cats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft.upload,
        lat: draft.lat,
        lng: draft.lng,
        location_name: draft.locationName,
        name: draft.name || null,
        story: draft.story || null,
        last_seen_at: null,
        additional_photos: draft.additionalUploads ?? [],
      }),
    })
    setLoading(false)
    if (!res.ok) { setError('Failed to add cat. Try again.'); return }
    const { id } = await res.json()
    clearDraft()
    router.push(`/cats/${id}`)
  }

  const progress = ['', 'Photo', 'Location', 'Details']
  const displayPreview = preview ?? draft.upload?.thumbnail_url ?? null
  const isSecure = typeof window !== 'undefined' && window.isSecureContext
  const totalExtras = extraPhotos.length + (draft.additionalUploads?.length ?? 0)
  const canAddMore = totalExtras < MAX_EXTRA && !!displayPreview

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <div key={n} className={`flex-1 h-1 rounded-full ${n <= draft.step ? 'bg-[#ff6b35]' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-4">Step {draft.step} of 3 — {progress[draft.step]}</p>

      {/* ── Step 1: Photo ─────────────────────────────────── */}
      {draft.step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Add cat photos</h2>
          <p className="text-sm text-gray-500">Add up to 5 photos. The first one will be the main photo.</p>

          {/* Primary photo preview */}
          {displayPreview ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#ffb99a] rounded-xl overflow-hidden cursor-pointer"
            >
              <img src={displayPreview} alt="preview" className="w-full object-cover max-h-52" />
              <p className="text-xs text-center text-gray-400 py-1">tap to change main photo</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-[#ffb99a] rounded-xl py-8 bg-[#fff8f5] cursor-pointer"
              >
                <span className="text-4xl">📷</span>
                <span className="text-sm font-semibold text-[#ff6b35]">Camera</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-[#ffb99a] rounded-xl py-8 bg-[#fff8f5] cursor-pointer"
              >
                <span className="text-4xl">🖼️</span>
                <span className="text-sm font-semibold text-[#ff6b35]">Gallery</span>
              </button>
            </div>
          )}

          {/* ── Extra photos strip ── */}
          {displayPreview && (
            <div>
              <p className="text-xs text-gray-400 mb-2">
                Additional photos <span className="text-gray-300">({totalExtras}/{MAX_EXTRA})</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {/* Persisted additional uploads */}
                {(draft.additionalUploads ?? []).map((u, i) => (
                  <div key={`p${i}`} className="relative w-16 h-16 flex-shrink-0">
                    <img src={u.thumbnail_url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                    <button
                      onClick={() => removePersistedExtra(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center leading-none"
                    >×</button>
                  </div>
                ))}
                {/* Pending new extra photos */}
                {extraPreviews.map((url, i) => (
                  <div key={`e${i}`} className="relative w-16 h-16 flex-shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-[#ffb99a]" />
                    <button
                      onClick={() => removeExtraPhoto(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center leading-none"
                    >×</button>
                  </div>
                ))}
                {/* Add more button */}
                {canAddMore && (
                  <button
                    onClick={() => extraFileRef.current?.click()}
                    className="w-16 h-16 border-2 border-dashed border-[#ffb99a] rounded-lg flex flex-col items-center justify-center bg-[#fff8f5] flex-shrink-0 cursor-pointer"
                  >
                    <span className="text-[#ff6b35] text-2xl leading-none">+</span>
                    <span className="text-[9px] text-[#ff6b35] mt-0.5">add</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hidden inputs */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleExtraFiles} />

          {error && <p className="text-red-500 text-xs">{error}</p>}
          {checking && (
            <p className="text-xs text-gray-400 animate-pulse text-center">🔍 Checking image safety…</p>
          )}
          {loading && (
            <p className="text-xs text-gray-400 animate-pulse text-center">
              ⬆️ Uploading {extraPhotos.length > 0 ? `${1 + extraPhotos.length} photos` : 'photo'}…
            </p>
          )}
          <button
            onClick={handlePhotoNext}
            disabled={loading || checking || (!photo && !draft.upload)}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Uploading…' : checking ? 'Checking…' : 'Next →'}
          </button>
        </div>
      )}

      {/* ── Step 2: Location ──────────────────────────────── */}
      {draft.step === 2 && (
        <div className="space-y-3">
          <h2 className="text-lg font-extrabold text-gray-900">Where was this cat?</h2>
          <p className="text-xs text-gray-400">
            Drag the 📍 pin to the exact spot, or use the button below to auto-detect.
          </p>

          <LocationPicker
            lat={draft.lat}
            lng={draft.lng}
            onChange={handlePinMove}
          />

          <div className="flex items-center justify-between bg-[#fff8f5] border border-[#ffe0cc] rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700 font-medium truncate pr-2">
              {draft.locationName ?? `${(draft.lat ?? MUMBAI.lat).toFixed(4)}, ${(draft.lng ?? MUMBAI.lng).toFixed(4)}`}
            </span>
            {gpsStatus === 'detecting' || gpsStatus === 'idle' ? (
              <span className="text-xs text-[#ff6b35] animate-pulse shrink-0">📡 Finding you…</span>
            ) : gpsStatus === 'unavailable' ? (
              <button
                onClick={tryGps}
                className="text-xs bg-[#ff6b35] text-white px-2 py-1 rounded-md shrink-0"
              >
                📡 Find me
              </button>
            ) : null}
          </div>

          {gpsStatus === 'unavailable' && (
            <p className="text-xs text-amber-600 flex items-start gap-1">
              <span>⚠️</span>
              <span>
                {isSecure
                  ? 'GPS denied — drag the pin to the right spot, or tap Find me to retry.'
                  : 'GPS needs HTTPS to auto-detect. Drag the pin to the spot — works perfectly!'}
              </span>
            </p>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={() => goTo(3)}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl"
          >
            Next →
          </button>
          <button onClick={() => goTo(1)} className="w-full text-gray-400 text-sm py-2">
            ← Back
          </button>
        </div>
      )}

      {/* ── Step 3: Details ───────────────────────────────── */}
      {draft.step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Tell us about this cat</h2>
          <p className="text-sm text-gray-400">All optional — you can skip straight to adding!</p>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Cat&apos;s name or nickname</label>
            <input
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Biscuit, Tiger, Mango…"
              className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Short story</label>
            <textarea
              value={draft.story}
              onChange={e => setDraft(prev => ({ ...prev, story: e.target.value }))}
              placeholder="What's special about this cat?"
              className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] h-28 resize-none focus:outline-none focus:border-[#ff6b35]"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Adding…' : '🐾 Add this cat!'}
          </button>
          <button onClick={() => goTo(2)} className="w-full text-gray-400 text-sm py-2">
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}
