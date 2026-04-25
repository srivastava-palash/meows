'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'

interface FlyToCoords { lat: number; lng: number; zoom: number }
interface MapCenter { lat: number; lng: number }

interface CityContextValue {
  city: string
  setCity: (city: string) => void
  flyToCoords: FlyToCoords | null
  setFlyToCoords: (coords: FlyToCoords | null) => void
  mapCenter: MapCenter
  setMapCenter: (center: MapCenter) => void
}

const CityContext = createContext<CityContextValue>({
  city: 'the World',
  setCity: () => {},
  flyToCoords: null,
  setFlyToCoords: () => {},
  mapCenter: { lat: 19.076, lng: 72.8777 },
  setMapCenter: () => {},
})

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState('the World')
  const [flyToCoords, setFlyToCoords] = useState<FlyToCoords | null>(null)
  const [mapCenter, setMapCenter] = useState<MapCenter>({ lat: 19.076, lng: 72.8777 })
  return (
    <CityContext.Provider value={{ city, setCity, flyToCoords, setFlyToCoords, mapCenter, setMapCenter }}>
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  return useContext(CityContext)
}
