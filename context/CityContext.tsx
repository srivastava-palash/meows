'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'

interface CityContextValue {
  city: string
  setCity: (city: string) => void
}

const CityContext = createContext<CityContextValue>({
  city: 'the World',
  setCity: () => {},
})

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState('the World')
  return (
    <CityContext.Provider value={{ city, setCity }}>
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  return useContext(CityContext)
}
