'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useCity } from '@/context/CityContext'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

// ── Inline SVG icons — no emoji, no icon library needed ──────────
function SearchIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  )
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function UserIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export default function Navbar({ initialUsername = null }: { initialUsername?: string | null }) {
  const router = useRouter()
  const { city, setFlyToCoords } = useCity()
  const [username, setUsername] = useState<string | null>(initialUsername)
  const [catCount, setCatCount] = useState<number | null>(null)

  // ── Search state ──────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = `Meows of ${city}`
  }, [city])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUsername(d.username ?? null)
    }).catch(() => {})
    fetch('/api/cats/count', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.count != null) setCatCount(d.count)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestions([])
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleSearch(q: string) {
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    if (q.trim().length < 2) { setSuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        setSuggestions(await r.json())
      } catch { /* ignore */ } finally {
        setSearchLoading(false)
      }
    }, 400)
  }

  function selectPlace(result: NominatimResult) {
    setFlyToCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), zoom: 13 })
    setSearchQuery(result.display_name.split(',')[0])
    setSuggestions([])
    setSearchOpen(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUsername(null)
    router.refresh()
  }

  // ── Brand click: go home + fly to current location ────────────
  const pathname = usePathname()
  const [brandLocating, setBrandLocating] = useState(false)

  function handleHomeClick() {
    if (pathname !== '/') router.push('/')
    if (!navigator.geolocation) return
    setBrandLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyToCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14 })
        setBrandLocating(false)
      },
      () => setBrandLocating(false),
      { timeout: 8000 }
    )
  }

  return (
    <nav ref={searchRef} style={{
      background: '#ff6b35',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* ── Main bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: 52,
        gap: 12,
      }}>

        {/* ── Brand — click to go home + fly to current location ── */}
        <button
          onClick={handleHomeClick}
          title="Go to my location"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            opacity: brandLocating ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          <span style={{
            fontSize: 20,
            lineHeight: 1,
            display: 'inline-block',
            animation: brandLocating ? 'pulse 1s infinite' : 'none',
          }}>🐾</span>
          <span style={{
            color: 'white',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
          }}>
            Meows
          </span>
          <span style={{
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 400,
            fontSize: 13,
            letterSpacing: '-0.2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            of {city}
          </span>
        </button>

        {/* ── Right actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

          {/* Cat count badge */}
          {catCount != null && (
            <span
              style={{
                background: 'rgba(0,0,0,0.15)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.2px',
                whiteSpace: 'nowrap',
              }}
            >
              {catCount}<span className="hidden sm:inline"> cats</span>
            </span>
          )}

          {/* Search button — no wrapper div needed, ref is on nav */}
          <button
            onClick={() => {
              setSearchOpen(o => !o)
              if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 999,
              padding: '6px 12px 6px 10px',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.15)')}
          >
            <SearchIcon size={13} color="rgba(255,255,255,0.9)" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Add button */}
          <Link
            href="/add"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'white',
              color: '#ff6b35',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 999,
              textDecoration: 'none',
              letterSpacing: '-0.1px',
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '1')}
          >
            <PlusIcon size={12} />
            <span className="hidden sm:inline">Add</span>
          </Link>

          {/* Auth */}
          {username ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link href="/profile" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999,
                padding: '5px 10px',
                color: 'white',
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <UserIcon size={13} />
                <span className="hidden sm:inline">{username}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="hidden sm:block"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 2px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 999,
              padding: '5px 10px',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              <UserIcon size={13} />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Search drawer — second row inside sticky nav, no fixed/absolute needed ── */}
      {searchOpen && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'white',
            borderRadius: suggestions.length > 0 ? '8px 8px 0 0' : 8,
            padding: '0 12px',
            gap: 10,
            height: 42,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            <SearchIcon size={15} color={searchLoading ? '#ff6b35' : '#bbb'} />
            <input
              ref={searchInputRef}
              autoFocus
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSuggestions([])
                  setSearchQuery('')
                  setSearchOpen(false)
                }
              }}
              placeholder="Search a city or place…"
              style={{
                border: 'none', outline: 'none', flex: 1,
                fontSize: 14, color: '#1a1a1a',
                background: 'transparent', fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSuggestions([]) }}
                style={{
                  background: '#f0f0f0', border: 'none', borderRadius: '50%',
                  width: 20, height: 20, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', fontSize: 11,
                  color: '#666', flexShrink: 0,
                }}
              >✕</button>
            )}
          </div>
          {suggestions.length > 0 && (
            <div style={{
              background: 'white',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={s.place_id}
                  onClick={() => selectPlace(s)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    border: 'none', borderTop: i > 0 ? '1px solid #f5f5f5' : 'none',
                    background: 'none', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef6f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ marginTop: 2, opacity: 0.35, flexShrink: 0 }}>
                    <SearchIcon size={13} color="#333" />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                      {s.display_name.split(',')[0]}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: '#999', marginTop: 1 }}>
                      {s.display_name.split(',').slice(1, 3).join(',').trim()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
