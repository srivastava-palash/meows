'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, borderRadius: 12, background: '#e8ead8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: '#888' }}>Loading map…</span>
    </div>
  ),
})

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
    const d = await r.json()
    return d.address?.suburb ?? d.address?.neighbourhood ?? d.address?.city_district ?? d.address?.city ?? null
  } catch { return null }
}

interface Props {
  catId: string
  initialLat: number
  initialLng: number
  initialLocationName: string | null
}

export default function EditLocationButton({ catId, initialLat, initialLng, initialLocationName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lat, setLat] = useState(initialLat)
  const [lng, setLng] = useState(initialLng)
  const [locationName, setLocationName] = useState<string | null>(initialLocationName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handlePinMove(newLat: number, newLng: number) {
    setLat(newLat)
    setLng(newLng)
    const name = await reverseGeocode(newLat, newLng)
    setLocationName(name)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/cats/${catId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, location_name: locationName }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save location.')
        return
      }
      setSaved(true)
      setOpen(false)
      router.refresh()  // re-fetch SSR page data
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    // Reset to original values
    setLat(initialLat)
    setLng(initialLng)
    setLocationName(initialLocationName)
    setError(null)
    setOpen(false)
  }

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={() => { setOpen(o => !o); setError(null) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: open ? '#fff0e8' : '#f9fafb',
          border: '1px solid',
          borderColor: open ? '#ff6b35' : '#e5e7eb',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: open ? '#ff6b35' : '#555',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span>📍</span>
        {open ? 'Cancel' : (saved ? '✓ Location saved' : 'Move pin')}
      </button>

      {/* Inline editor */}
      {open && (
        <div style={{
          marginTop: 12,
          border: '1px solid #ffe0cc',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff8f5',
        }}>
          {/* Location label */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid #ffe0cc',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 13, color: '#555' }}>
              📍 {locationName ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
            </span>
            {locationName && (
              <span style={{ fontSize: 11, color: '#bbb' }}>
                ({lat.toFixed(4)}, {lng.toFixed(4)})
              </span>
            )}
          </div>

          {/* Map picker */}
          <div style={{ padding: 12 }}>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              Drag the 📍 pin to correct the cat&apos;s location.
            </p>
            <LocationPicker lat={lat} lng={lng} onChange={handlePinMove} />
          </div>

          {/* Actions */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid #ffe0cc',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: '#ff6b35',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : '✓ Save location'}
            </button>
            <button
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                fontSize: 13,
                cursor: 'pointer',
                padding: '8px 4px',
              }}
            >
              Cancel
            </button>
            {error && (
              <span style={{ fontSize: 12, color: '#e53e3e', marginLeft: 4 }}>{error}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
