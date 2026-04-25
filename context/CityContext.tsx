'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'

interface FlyToCoords { lat: number; lng: number; zoom: number }

interface CityContextValue {
  city: string
  setCity: (city: string) => void
  flyToCoords: FlyToCoords | null
  setFlyToCoords: (coords: FlyToCoords | null) => void
}

const CityContext = createContext<CityContextValue>({
  city: 'the World',
  setCity: () => {},
  flyToCoords: null,
  setFlyToCoords: () => {},
})

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState('the World')
  const [flyToCoords, setFlyToCoords] = useState<FlyToCoords | null>(null)
  return (
    <CityContext.Provider value={{ city, setCity, flyToCoords, setFlyToCoords }}>
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  return useContext(CityContext)
}
