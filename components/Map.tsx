'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import type { CatPin } from '@/types'
import { useCity } from '@/context/CityContext'

// Leaflet and leaflet.markercluster are loaded at runtime only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: any

// ── Map themes ────────────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'soft',
    label: 'Soft',
    emoji: '🌸',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    options: { subdomains: 'abcd', maxZoom: 19 },
    preview: '#e8e4dc',
  },
  {
    id: 'standard',
    label: 'Standard',
    emoji: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    options: { maxZoom: 19 },
    preview: '#c8dfc8',
  },
  {
    id: 'dark',
    label: 'Dark',
    emoji: '🌑',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    options: { subdomains: 'abcd', maxZoom: 19 },
    preview: '#2b2b3b',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    emoji: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
    options: { maxZoom: 18 },
    preview: '#3d5a3e',
  },
] as const

type ThemeId = typeof THEMES[number]['id']
const THEME_KEY = 'meows-map-theme'

function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'soft'
  return (localStorage.getItem(THEME_KEY) as ThemeId) ?? 'soft'
}

// Reverse geocode a lat/lng to a city-level name (zoom=10 = city granularity)
async function getCityName(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const d = await r.json()
    return (
      d.address?.city ??
      d.address?.town ??
      d.address?.village ??
      d.address?.county ??
      d.address?.state ??
      'this area'
    )
  } catch {
    return 'this area'
  }
}

// Small helper — reads city from context to label the popup
function AreaLabel({ mode }: { mode: 'recent' | 'loved' }) {
  const { city } = useCity()
  const label = mode === 'recent' ? 'Most Recent' : 'Most Loved'
  return (
    <div style={{
      padding: '7px 14px',
      borderBottom: '1px solid #f3f4f6',
      fontSize: 11,
      fontWeight: 700,
      color: '#ff6b35',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
    }}>
      {label} in {city ?? 'this area'}
    </div>
  )
}

export default function Map() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null)
  const sortRef = useRef<'recent' | 'loved'>('recent') // mutable ref so moveend always reads latest

  const [activeTheme, setActiveTheme] = useState<ThemeId>('soft')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sort, setSort] = useState<'recent' | 'loved'>('recent')
  const { setCity } = useCity()
  // Ref so fetchAndRenderPins (memoised with []) can always call latest setCity
  const setCityRef = useRef(setCity)
  useEffect(() => { setCityRef.current = setCity }, [setCity])
  // Monotonic counter — stale fetch responses are discarded if a newer one started
  const fetchIdRef = useRef(0)

  // ── Sort quick-access popup ──────────────────────────────────────
  const [sortPopup, setSortPopup] = useState<'recent' | 'loved' | null>(null)
  const [popupCats, setPopupCats] = useState<import('@/types').CatPin[]>([])
  const [popupLoading, setPopupLoading] = useState(false)
  const sortToggleRef = useRef<HTMLDivElement>(null)

  async function openSortPopup(mode: 'recent' | 'loved') {
    // Toggle: clicking the same active mode closes the popup
    if (sortPopup === mode) { setSortPopup(null); return }
    setSortPopup(mode)
    setPopupLoading(true)
    try {
      // Use the current map viewport — popup shows top cats in this area
      const map = mapInstanceRef.current
      if (!map) return
      const bounds = map.getBounds()
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      // Clamp to valid bbox limits
      const swLat = Math.max(sw.lat, -90)
      const swLng = Math.max(sw.lng, -180)
      const neLat = Math.min(ne.lat, 90)
      const neLng = Math.min(ne.lng, 180)
      const res = await fetch(
        `/api/cats?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}&sort=${mode}`
      )
      if (res.ok) setPopupCats((await res.json() as import('@/types').CatPin[]).slice(0, 5))
    } catch { /* ignore */ } finally {
      setPopupLoading(false)
    }
  }

  // Close popup on click outside the toggle+popup area
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (sortToggleRef.current && !sortToggleRef.current.contains(e.target as Node)) {
        setSortPopup(null)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // ── Location search ───────────────────────────────────────────────
  interface NominatimResult {
    place_id: number
    display_name: string
    lat: string
    lon: string
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)

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
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    mapInstanceRef.current?.flyTo([lat, lng], 13)
    // Derive a short label from the first part of display_name
    setSearchQuery(result.display_name.split(',')[0])
    setSuggestions([])
  }

  // Close dropdown on click outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Hydrate saved theme after mount
  useEffect(() => { setActiveTheme(getSavedTheme()) }, [])

  const fetchAndRenderPins = useCallback(async (map: import('leaflet').Map, sortBy: 'recent' | 'loved' = 'recent') => {
    const myId = ++fetchIdRef.current   // grab a unique ID for this invocation

    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    // Clear immediately so the toggle feels instant
    clusterRef.current.clearLayers()

    const params = new URLSearchParams({
      swLat: String(sw.lat),
      swLng: String(sw.lng),
      neLat: String(ne.lat),
      neLng: String(ne.lng),
      sort: sortBy,
    })

    const res = await fetch(`/api/cats?${params}`)
    if (!res.ok) return
    // Discard results if a newer fetch has already started
    if (myId !== fetchIdRef.current) return

    // Top 10 only — DB already returns them in the correct order
    // (created_at DESC for recent, upvote_count DESC for loved)
    const pins: CatPin[] = (await res.json()).slice(0, 10)

    pins.forEach((pin) => {
      // Larger marker (60px) so the top-10 stand out
      const size = 60
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          border:3px solid ${sortBy === 'loved' && (pin.upvote_count ?? 0) > 0 ? '#e05a2b' : '#ff6b35'};
          background:url(${pin.thumbnail_url}) center/cover;
          box-shadow:0 3px 12px rgba(0,0,0,0.3);cursor:pointer;
          position:relative;
        ">
          ${sortBy === 'loved' && (pin.upvote_count ?? 0) > 0
            ? `<span style="position:absolute;bottom:-4px;right:-4px;background:white;border-radius:50%;
                font-size:13px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;
                box-shadow:0 1px 4px rgba(0,0,0,0.2);">❤️</span>`
            : ''}
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const marker = L.marker([pin.lat, pin.lng], { icon })
      marker.bindPopup(`
        <div style="min-width:160px;font-family:sans-serif;">
          <img src="${pin.thumbnail_url}" style="width:100%;border-radius:8px;margin-bottom:6px;" />
          <div style="font-weight:700;font-size:13px;">${pin.name ?? 'Unknown cat'}</div>
          <div style="font-size:11px;color:#888;margin:2px 0 8px;">${pin.location_name ?? ''}</div>
          <a href="/cats/${pin.id}" style="
            display:block;background:#ff6b35;color:white;text-align:center;
            padding:6px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;
          ">See full story →</a>
          <button
            id="upvote-${pin.id}"
            data-upvoted="0"
            onclick="window.meowsUpvote('${pin.id}')"
            style="
              display:flex;align-items:center;justify-content:center;gap:5px;
              width:100%;margin-top:8px;padding:6px;
              background:#fff0eb;border:1.5px solid #ffb99a;
              border-radius:6px;font-size:12px;font-weight:600;
              color:#e05a2b;cursor:pointer;
            "
          >
            ❤️ <span id="upvote-count-${pin.id}">${pin.upvote_count ?? 0}</span> loves
          </button>
        </div>
      `)
      // Clicking a marker → immediately update city from pin coordinates
      marker.on('click', async () => {
        const name = await getCityName(pin.lat, pin.lng)
        setCityRef.current(name)
      })
      clusterRef.current.addLayer(marker)
    })
  }, [])

  // Init map once
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return

    async function init() {
      L = (await import('leaflet')).default
      await import('leaflet.markercluster')

      if (mapInstanceRef.current) return

      // Global upvote handler for popup buttons (Leaflet popups are plain HTML, not React)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).meowsUpvote = async (catId: string) => {
        const btn = document.getElementById(`upvote-${catId}`)
        const countEl = document.getElementById(`upvote-count-${catId}`)
        if (!btn || !countEl) return
        btn.style.opacity = '0.6'
        try {
          const res = await fetch(`/api/cats/${catId}/upvote`, {
            method: 'POST',
            headers: (() => {
              try {
                let id = localStorage.getItem('meows_voter')
                if (!id) { id = crypto.randomUUID(); localStorage.setItem('meows_voter', id) }
                return { 'x-voter-id': id } as Record<string, string>
              } catch { return {} as Record<string, string> }
            })(),
          })
          if (!res.ok) return
          const { upvoted, count } = await res.json()
          countEl.textContent = String(count)
          btn.setAttribute('data-upvoted', upvoted ? '1' : '0')
          btn.style.background = upvoted ? '#ffe0cc' : '#fff0eb'
          btn.style.borderColor = upvoted ? '#ff6b35' : '#ffb99a'
        } finally {
          btn.style.opacity = '1'
        }
      }

      const savedTheme = getSavedTheme()
      const theme = THEMES.find(t => t.id === savedTheme) ?? THEMES[0]

      const map = L.map(mapRef.current!, {
        center: [20, 0],  // world-centred default
        zoom: 3,
      })

      const tile = L.tileLayer(theme.url, {
        attribution: theme.attribution,
        ...theme.options,
      }).addTo(map)

      tileLayerRef.current = tile

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (L as any).markerClusterGroup({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction: (c: any) =>
          L.divIcon({
            html: `<div style="
              width:40px;height:40px;border-radius:50%;background:#ff6b35;
              color:white;font-weight:800;font-size:14px;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">${c.getChildCount()}</div>`,
            className: '',
            iconSize: [40, 40],
          }),
      })
      map.addLayer(cluster)

      // "My Location" button
      const locControl = L.Control.extend({
        onAdd() {
          const btn = L.DomUtil.create('button')
          btn.innerHTML = '📍 My Location'
          btn.style.cssText = 'background:white;border:none;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);margin-bottom:8px;'
          L.DomEvent.on(btn, 'click', () => {
            navigator.geolocation.getCurrentPosition(async pos => {
              map.setView([pos.coords.latitude, pos.coords.longitude], 13)
              const name = await getCityName(pos.coords.latitude, pos.coords.longitude)
              setCity(name)
            })
          })
          return btn
        },
      })
      new locControl({ position: 'bottomright' }).addTo(map)

      mapInstanceRef.current = map
      clusterRef.current = cluster

      // Reverse geocode on moveend (debounced 1s — don't hammer Nominatim)
      let cityTimer: ReturnType<typeof setTimeout>
      let pinsTimer: ReturnType<typeof setTimeout>
      map.on('moveend', () => {
        clearTimeout(pinsTimer)
        clearTimeout(cityTimer)
        pinsTimer = setTimeout(() => fetchAndRenderPins(map, sortRef.current), 300)
        cityTimer = setTimeout(async () => {
          const zoom = map.getZoom()
          if (zoom < 8) {
            setCityRef.current('the World')
          } else {
            const c = map.getCenter()
            const name = await getCityName(c.lat, c.lng)
            setCityRef.current(name)
          }
        }, 600) // 600ms debounce — snappy but avoids hammering Nominatim
      })

      // Try GPS to set initial center (HTTPS only)
      if (window.isSecureContext && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 13)
            // setView triggers moveend which will fetch pins — no explicit call needed
            const name = await getCityName(pos.coords.latitude, pos.coords.longitude)
            setCityRef.current(name)
          },
          () => {/* silently fall back to Mumbai default */}
        )
      }

      await fetchAndRenderPins(map, 'recent')
    }

    init()

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      clusterRef.current = null
      tileLayerRef.current = null
    }
  }, [fetchAndRenderPins])

  // Change sort — update ref (for moveend) + state (for UI) + refetch
  function changeSort(newSort: 'recent' | 'loved') {
    sortRef.current = newSort
    setSort(newSort)
    if (mapInstanceRef.current) {
      fetchAndRenderPins(mapInstanceRef.current, newSort)
    }
    openSortPopup(newSort)
  }

  // Switch tile layer when theme changes
  function applyTheme(id: ThemeId) {
    const theme = THEMES.find(t => t.id === id)
    if (!theme || !mapInstanceRef.current || !L) return
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current)
    }
    tileLayerRef.current = L.tileLayer(theme.url, {
      attribution: theme.attribution,
      ...theme.options,
    }).addTo(mapInstanceRef.current)
    localStorage.setItem(THEME_KEY, id)
    setActiveTheme(id)
    setPickerOpen(false)
  }

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 44px)', width: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

      {/* ── Location search bar ──────────────────── */}
      <div
        ref={searchRef}
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          width: 'min(340px, 90vw)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'white',
          borderRadius: suggestions.length > 0 ? '12px 12px 0 0' : 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          padding: '7px 12px',
          gap: 6,
        }}>
          <span style={{ fontSize: 15, opacity: 0.5 }}>{searchLoading ? '⏳' : '🔍'}</span>
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setSuggestions([])}
            placeholder="Search a city or place…"
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'transparent',
              color: '#222',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSuggestions([]) }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#aaa', padding: 0 }}
            >×</button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}>
            {suggestions.map((s, i) => (
              <button
                key={s.place_id}
                onClick={() => selectPlace(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#333',
                  lineHeight: 1.4,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fff5f1')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontWeight: 600 }}>{s.display_name.split(',')[0]}</span>
                <span style={{ color: '#999', marginLeft: 4 }}>
                  {s.display_name.split(',').slice(1, 3).join(',').trim()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Sort toggle + quick-access popup ────────────────── */}
      <div
        ref={sortToggleRef}
        style={{
          position: 'absolute',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          fontFamily: 'sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 'min(320px, 88vw)',
        }}
      >
        {/* Toggle buttons */}
        <div style={{
          display: 'flex',
          background: 'white',
          borderRadius: sortPopup ? '12px 12px 0 0' : 999,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          width: '100%',
        }}>
          {(['recent', 'loved'] as const).map(s => (
            <button
              key={s}
              onClick={() => changeSort(s)}
              style={{
                flex: 1,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: sort === s ? 700 : 500,
                border: 'none',
                cursor: 'pointer',
                background: sort === s ? '#ff6b35' : 'transparent',
                color: sort === s ? 'white' : '#555',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {s === 'recent' ? '🕐 Recent' : '❤️ Most Loved'}
            </button>
          ))}
        </div>

        {/* Quick-access dropdown */}
        {sortPopup && (
          <div style={{
            width: '100%',
            background: 'white',
            borderRadius: '0 0 14px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            overflow: 'hidden',
          }}>
            {/* Area label */}
            <AreaLabel mode={sortPopup} />
            {popupLoading ? (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Loading…
              </div>
            ) : popupCats.length === 0 ? (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                No cats in this area yet — pan the map!
              </div>
            ) : (
              popupCats.map((cat, i) => (
                <a
                  key={cat.id}
                  href={`/cats/${cat.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 14px',
                    borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fff5f1')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Rank number */}
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#ff6b35', width: 16, flexShrink: 0, textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  {/* Thumbnail */}
                  <img
                    src={cat.thumbnail_url}
                    alt=""
                    style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name ?? 'Unknown cat'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.location_name ?? ''}
                    </div>
                  </div>
                  {/* Metric */}
                  <span style={{ fontSize: 11, color: sortPopup === 'loved' ? '#ff6b35' : '#9ca3af', flexShrink: 0, fontWeight: sortPopup === 'loved' ? 700 : 400 }}>
                    {sortPopup === 'loved'
                      ? `♥ ${cat.upvote_count ?? 0}`
                      : new Date(cat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </a>
              ))
            )}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 14px', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>click to open full story</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Map theme picker ──────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 36,
        left: 12,
        zIndex: 1000,
        fontFamily: 'sans-serif',
      }}>
        {/* Expanded picker */}
        {pickerOpen && (
          <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 8,
            background: 'white',
            borderRadius: 12,
            padding: '8px 10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}>
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                title={theme.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  border: activeTheme === theme.id ? '2.5px solid #ff6b35' : '2.5px solid transparent',
                  borderRadius: 10,
                  padding: '4px 6px',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Preview swatch */}
                <div style={{
                  width: 44,
                  height: 36,
                  borderRadius: 6,
                  background: theme.preview,
                  border: '1px solid rgba(0,0,0,0.1)',
                  fontSize: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {theme.emoji}
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: activeTheme === theme.id ? 700 : 500,
                  color: activeTheme === theme.id ? '#ff6b35' : '#555',
                }}>
                  {theme.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setPickerOpen(o => !o)}
          title="Change map style"
          style={{
            background: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#333',
          }}
        >
          {THEMES.find(t => t.id === activeTheme)?.emoji ?? '🗺️'}
          {' '}
          {THEMES.find(t => t.id === activeTheme)?.label ?? 'Map style'}
          {' '}
          <span style={{ fontSize: 9, opacity: 0.5 }}>{pickerOpen ? '▼' : '▲'}</span>
        </button>
      </div>
    </div>
  )
}
