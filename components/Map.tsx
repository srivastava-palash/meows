'use client'
import { useEffect, useRef, useCallback } from 'react'
import type { CatPin } from '@/types'

// Leaflet and leaflet.markercluster are loaded at runtime only
let L: typeof import('leaflet')

export default function Map() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null)

  const fetchAndRenderPins = useCallback(async (map: import('leaflet').Map) => {
    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    const params = new URLSearchParams({
      swLat: String(sw.lat),
      swLng: String(sw.lng),
      neLat: String(ne.lat),
      neLng: String(ne.lng),
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
        </div>
      `)
      clusterRef.current.addLayer(marker)
    })
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return

    async function init() {
      L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      const map = L.map(mapRef.current!, {
        center: [19.076, 72.8777], // Mumbai
        zoom: 13,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

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
          btn.style.cssText = 'background:white;border:none;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);'
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

      // Debounced moveend
      let timer: ReturnType<typeof setTimeout>
      map.on('moveend', () => {
        clearTimeout(timer)
        timer = setTimeout(() => fetchAndRenderPins(map), 300)
      })

      // Initial load
      await fetchAndRenderPins(map)
    }

    init()
  }, [fetchAndRenderPins])

  return <div ref={mapRef} style={{ height: 'calc(100vh - 44px)', width: '100%' }} />
}
