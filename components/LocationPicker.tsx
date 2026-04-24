'use client'
import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: any

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    async function init() {
      L = (await import('leaflet')).default
      await import('leaflet.markercluster') // side-effect: registers L.markerClusterGroup (not needed here but keeps CSS consistent)

      if (mapRef.current) return // guard double-init in StrictMode

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:#ff6b35;border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-size:18px;cursor:grab;
        ">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })

      const marker = L.marker([lat, lng], { icon, draggable: true })
      marker.addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onChange(pos.lat, pos.lng)
      })

      mapRef.current = map
      markerRef.current = marker
    }

    init()

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep marker in sync if parent updates lat/lng (e.g. from GPS "find me")
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current.setView([lat, lng], mapRef.current.getZoom())
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      style={{ height: 220, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #ffe0cc' }}
    />
  )
}
