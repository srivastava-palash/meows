'use client'
import { useState } from 'react'

interface Props {
  photos: string[]
  alt: string
}

// Shared blurred-backdrop frame used by both single and carousel views.
// Renders the same image twice:
//   1. Behind: scaled to fill, heavily blurred — fills letterbox space with photo colours
//   2. In front: object-contain — shows the full image without any cropping
function BlurFrame({
  src,
  alt,
  children,
}: {
  src: string
  alt: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', maxHeight: '70dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Blurred backdrop — same image, fills the frame */}
      <img
        src={src}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(22px) brightness(0.55) saturate(1.3)',
          transform: 'scale(1.08)', // avoids blur edge bleed
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      {/* Sharp foreground image */}
      <img
        src={src}
        alt={alt}
        style={{
          position: 'relative',
          display: 'block',
          maxWidth: '100%',
          maxHeight: '70dvh',
          objectFit: 'contain',
          zIndex: 1,
        }}
      />
      {/* Overlay slots (arrows, badge, etc.) */}
      {children}
    </div>
  )
}

export default function PhotoGallery({ photos, alt }: Props) {
  const [current, setCurrent] = useState(0)

  // Single photo — no chrome, just the blur-backdrop frame
  if (photos.length <= 1) {
    return <BlurFrame src={photos[0]} alt={alt} />
  }

  const prev = () => setCurrent(i => (i - 1 + photos.length) % photos.length)
  const next = () => setCurrent(i => (i + 1) % photos.length)

  return (
    <div>
      {/* Main image with blur backdrop */}
      <BlurFrame src={photos[current]} alt={`${alt} — photo ${current + 1} of ${photos.length}`}>
        {/* Prev arrow */}
        <button
          onClick={prev}
          aria-label="Previous photo"
          style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, color: 'white', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)', zIndex: 2,
          }}
        >‹</button>

        {/* Next arrow */}
        <button
          onClick={next}
          aria-label="Next photo"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, color: 'white', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)', zIndex: 2,
          }}
        >›</button>

        {/* Counter badge */}
        <span style={{
          position: 'absolute', bottom: 10, right: 12, zIndex: 2,
          background: 'rgba(0,0,0,0.45)', color: 'white',
          fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 999,
          backdropFilter: 'blur(4px)',
        }}>
          {current + 1} / {photos.length}
        </span>
      </BlurFrame>

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
