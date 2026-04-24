'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import type { CatPin } from '@/types'

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

  // Hydrate saved theme after mount
  useEffect(() => { setActiveTheme(getSavedTheme()) }, [])

  const fetchAndRenderPins = useCallback(async (map: import('leaflet').Map, sortBy: 'recent' | 'loved' = 'recent') => {
    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    const params = new URLSearchParams({
      swLat: String(sw.lat),
      swLng: String(sw.lng),
      neLat: String(ne.lat),
      neLng: String(ne.lng),
      sort: sortBy,
    })

    const res = await fetch(`/api/cats?${params}`)
    if (!res.ok) return
    const pins: CatPin[] = await res.json()

    clusterRef.current.clearLayers()

    pins.forEach((pin) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:48px;height:48px;border-radius:50%;border:3px solid #ff6b35;
          background:url(${pin.thumbnail_url}) center/cover;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;
        "></div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
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
          const res = await fetch(`/api/cats/${catId}/upvote`, { method: 'POST' })
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
        center: [19.076, 72.8777],
        zoom: 13,
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
            navigator.geolocation.getCurrentPosition(pos => {
              map.setView([pos.coords.latitude, pos.coords.longitude], 15)
            })
          })
          return btn
        },
      })
      new locControl({ position: 'bottomright' }).addTo(map)

      mapInstanceRef.current = map
      clusterRef.current = cluster

      let timer: ReturnType<typeof setTimeout>
      map.on('moveend', () => {
        clearTimeout(timer)
        // Read sort from closure-captured ref so we always use latest value
        timer = setTimeout(() => fetchAndRenderPins(map, sortRef.current), 300)
      })

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

      {/* ── Sort toggle ────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        background: 'white',
        borderRadius: 999,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
      }}>
        {(['recent', 'loved'] as const).map(s => (
          <button
            key={s}
            onClick={() => changeSort(s)}
            style={{
              padding: '6px 14px',
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
