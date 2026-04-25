'use client'
import { useState } from 'react'

interface Props {
  photos: string[]
  alt: string
}

export default function PhotoGallery({ photos, alt }: Props) {
  const [current, setCurrent] = useState(0)

  // Single photo — plain image, no chrome
  if (photos.length <= 1) {
    return (
      <img
        src={photos[0]}
        alt={alt}
        className="w-full max-h-80 object-cover"
      />
    )
  }

  const prev = () => setCurrent(i => (i - 1 + photos.length) % photos.length)
  const next = () => setCurrent(i => (i + 1) % photos.length)

  return (
    <div style={{ position: 'relative', background: '#111' }}>
      {/* Main image */}
      <div style={{ position: 'relative', overflow: 'hidden', maxHeight: 320 }}>
        <img
          src={photos[current]}
          alt={`${alt} — photo ${current + 1} of ${photos.length}`}
          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block', transition: 'opacity 0.2s' }}
        />

        {/* Prev / Next arrows */}
        <button
          onClick={prev}
          aria-label="Previous photo"
          style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, color: 'white', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >‹</button>
        <button
          onClick={next}
          aria-label="Next photo"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, color: 'white', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >›</button>

        {/* Counter badge */}
        <span style={{
          position: 'absolute', bottom: 10, right: 12,
          background: 'rgba(0,0,0,0.5)', color: 'white',
          fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 999,
          backdropFilter: 'blur(4px)',
        }}>
          {current + 1} / {photos.length}
        </span>
      </div>

      {/* Dot indicators */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 6,
        padding: '8px 0', background: '#111',
      }}>
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to photo ${i + 1}`}
            style={{
              width: i === current ? 20 : 7,
              height: 7,
              borderRadius: 999,
              background: i === current ? '#ff6b35' : 'rgba(255,255,255,0.35)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Thumbnail strip */}
      <div style={{
        display: 'flex', gap: 4, padding: '0 4px 8px',
        background: '#111', overflowX: 'auto',
      }}>
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              flexShrink: 0,
              width: 56, height: 56,
              borderRadius: 6,
              overflow: 'hidden',
              border: i === current ? '2.5px solid #ff6b35' : '2.5px solid transparent',
              padding: 0,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <img
              src={url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
