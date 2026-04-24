'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { UploadResult } from '@/types'

type Step = 1 | 2 | 3

interface FormState {
  photo: File | null
  preview: string | null
  upload: UploadResult | null
  lat: number | null
  lng: number | null
  locationName: string | null
  name: string
  story: string
  lastSeenAt: string
}

export default function AddCatForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<FormState>({
    photo: null, preview: null, upload: null,
    lat: null, lng: null, locationName: null,
    name: '', story: '', lastSeenAt: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 1: Photo selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setState(s => ({ ...s, photo: file, preview: URL.createObjectURL(file) }))
  }

  async function handlePhotoNext() {
    if (!state.photo) { setError('Please select a photo'); return }
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.append('photo', state.photo)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    setLoading(false)
    if (!res.ok) { setError('Upload failed. Try again.'); return }
    const upload: UploadResult = await res.json()
    setState(s => ({ ...s, upload }))
    setStep(2)
    // Auto-detect GPS
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setState(s => ({ ...s, lat, lng }))
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then(r => r.json())
          .then(d => {
            const name = d.address?.suburb ?? d.address?.neighbourhood ?? d.address?.city_district ?? null
            setState(s => ({ ...s, locationName: name }))
          })
          .catch(() => {})
      },
      () => {} // GPS denied — user can skip
    )
  }

  async function handleSubmit() {
    if (!state.upload || state.lat == null || state.lng == null) {
      setError('Location is required')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/cats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state.upload,
        lat: state.lat,
        lng: state.lng,
        location_name: state.locationName,
        name: state.name || null,
        story: state.story || null,
        last_seen_at: state.lastSeenAt || null,
      }),
    })
    setLoading(false)
    if (!res.ok) { setError('Failed to add cat. Try again.'); return }
    const { id } = await res.json()
    router.push(`/cats/${id}`)
  }

  const progress = ['', 'Photo', 'Location', 'Details']

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-[#ff6b35]' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-4">Step {step} of 3 — {progress[step]}</p>

      {/* Step 1: Photo */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Add a cat photo</h2>
          <p className="text-sm text-gray-500">Show us who you found!</p>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#ffb99a] rounded-xl p-10 text-center bg-[#fff8f5] cursor-pointer"
          >
            {state.preview ? (
              <img src={state.preview} alt="preview" className="w-full rounded-lg object-cover max-h-48" />
            ) : (
              <>
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm font-semibold text-[#ff6b35]">Take a photo</p>
                <p className="text-xs text-gray-400 mt-1">or tap to upload from gallery</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handlePhotoNext}
            disabled={loading || !state.photo}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Uploading…' : 'Next →'}
          </button>
        </div>
      )}

      {/* Step 2: Location */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Where was this cat?</h2>
          {state.lat && state.lng ? (
            <div className="bg-[#fff8f5] border border-[#ffe0cc] rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">📍</div>
              <p className="text-sm font-semibold text-gray-800">{state.locationName ?? 'Location detected'}</p>
              <p className="text-xs text-gray-400 mt-1">{state.lat.toFixed(5)}, {state.lng.toFixed(5)}</p>
            </div>
          ) : (
            <div className="bg-[#fff8f5] border border-[#ffe0cc] rounded-xl p-6 text-center text-gray-400 text-sm">
              Detecting GPS location…
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            Location is auto-detected from your device. On desktop, grant browser location access.
          </p>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={() => setStep(3)}
            disabled={state.lat == null}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            Next →
          </button>
          <button onClick={() => setStep(1)} className="w-full text-gray-400 text-sm py-2">
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Tell us about this cat</h2>
          <p className="text-sm text-gray-400">All optional — you can skip straight to adding!</p>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Cat&apos;s name or nickname</label>
            <input
              value={state.name}
              onChange={e => setState(s => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Biscuit, Tiger, Mango…"
              className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Short story</label>
            <textarea
              value={state.story}
              onChange={e => setState(s => ({ ...s, story: e.target.value }))}
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
          <button onClick={() => setStep(2)} className="w-full text-gray-400 text-sm py-2">
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}
