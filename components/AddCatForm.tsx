'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { UploadResult } from '@/types'

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
  lat: number
  lng: number
  locationName: string | null
  name: string
  story: string
}

const SESSION_KEY = 'meows-add-cat-draft'
const MUMBAI = { lat: 19.076, lng: 72.8777 }

function loadDraft(): PersistedState {
  if (typeof window === 'undefined') return defaultDraft()
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState
      // Guard against stale drafts from old code where lat/lng were nullable
      return {
        ...parsed,
        lat: parsed.lat ?? MUMBAI.lat,
        lng: parsed.lng ?? MUMBAI.lng,
      }
    }
  } catch {}
  return defaultDraft()
}

function defaultDraft(): PersistedState {
  return { step: 1, upload: null, lat: MUMBAI.lat, lng: MUMBAI.lng, locationName: null, name: '', story: '' }
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

// ── NSFW guard (browser-only, lazily loaded on first photo pick) ───────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nsfwModel: any = null

async function checkNsfw(objectUrl: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    if (!nsfwModel) {
      await import('@tensorflow/tfjs')
      const nsfwjs = await import('nsfwjs')
      nsfwModel = await nsfwjs.load()
    }
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
    console.warn('NSFW check skipped (model unavailable):', e)
    return { safe: true } // fail open — never block real users over a model error
  }
}

export default function AddCatForm() {
  const router = useRouter()

  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [draft, setDraftRaw] = useState<PersistedState>(defaultDraft)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'done' | 'unavailable'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)   // true while NSFW model runs
  const fileRef = useRef<HTMLInputElement>(null)    // gallery
  const cameraRef = useRef<HTMLInputElement>(null)  // direct camera

  // Hydrate from sessionStorage after mount
  useEffect(() => {
    const saved = loadDraft()
    setDraftRaw(saved)
    if (saved.upload) setPreview(saved.upload.thumbnail_url)
  }, [])

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

  // Called when user drags the pin
  async function handlePinMove(lat: number, lng: number) {
    setDraft(prev => ({ ...prev, lat, lng }))
    const name = await reverseGeocode(lat, lng)
    setDraft(prev => ({ ...prev, locationName: name }))
  }

  // GPS — only works on secure context (https or localhost)
  async function tryGps() {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return
    }
    if (!window.isSecureContext) {
      setGpsStatus('unavailable')
      return
    }
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

  // On entering step 2: always auto-try GPS (works on HTTPS; fails fast on HTTP → shows Find me button)
  function enterStep2() {
    goTo(2)
    setGpsStatus('idle')
    if (typeof window !== 'undefined' && navigator.geolocation) {
      tryGps()
    } else {
      setGpsStatus('unavailable')
    }
  }

  // Step 1: photo — show preview immediately, then run NSFW check async
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

  async function handlePhotoNext() {
    if (!photo && !draft.upload) { setError('Please select a photo'); return }
    if (draft.upload && !photo) { enterStep2(); return } // already uploaded, skip re-upload
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.append('photo', photo!)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    setLoading(false)
    if (!res.ok) { setError('Upload failed. Try again.'); return }
    const upload: UploadResult = await res.json()
    setDraft(prev => ({ ...prev, upload }))
    enterStep2()
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
          <h2 className="text-lg font-extrabold text-gray-900">Add a cat photo</h2>
          <p className="text-sm text-gray-500">Show us who you found!</p>
          {/* Preview — tapping re-opens gallery */}
          {displayPreview ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#ffb99a] rounded-xl overflow-hidden cursor-pointer"
            >
              <img src={displayPreview} alt="preview" className="w-full object-cover max-h-52" />
              <p className="text-xs text-center text-gray-400 py-1">tap to change</p>
            </div>
          ) : (
            /* Two-button picker */
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
          {/* Camera input — triggers native camera directly */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          {/* Gallery input — opens file picker / photo library */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {checking && (
            <p className="text-xs text-gray-400 animate-pulse text-center">🔍 Checking image safety…</p>
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

          {/* Draggable map — always shown, works on HTTP and HTTPS */}
          <LocationPicker
            lat={draft.lat}
            lng={draft.lng}
            onChange={handlePinMove}
          />

          {/* Location label + GPS status */}
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
            ) : null /* gpsStatus === 'done' — pin already centred, no button needed */}
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
