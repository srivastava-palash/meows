'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useCity } from '@/context/CityContext'

export default function Navbar({ initialUsername = null }: { initialUsername?: string | null }) {
  const router = useRouter()
  const { city } = useCity()
  const [username, setUsername] = useState<string | null>(initialUsername)
  const [catCount, setCatCount] = useState<number | null>(null)

  // Keep browser tab title in sync with the current city
  useEffect(() => {
    document.title = `🐾 Meows of ${city}`
  }, [city])

  useEffect(() => {
    // Sync auth state on client (covers client-side navigations where initialUsername won't update)
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUsername(d.username ?? null)
    }).catch(() => {})
    fetch('/api/cats/count', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.count != null) setCatCount(d.count)
    }).catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUsername(null)
    router.refresh()
  }

  return (
    <nav className="bg-[#ff6b35] px-3 py-2 sticky top-0 z-50">
      <div className="flex items-center justify-between gap-2">
        {/* Left: brand */}
        <Link href="/" className="text-white font-extrabold text-sm sm:text-base tracking-tight whitespace-nowrap shrink-0">
          🐾 Meows of {city}
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {catCount != null && (
            <span className="text-white/80 text-[10px] sm:text-xs whitespace-nowrap">
              🐱 {catCount}
            </span>
          )}
          <Link
            href="/add"
            className="bg-white text-[#ff6b35] text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap"
          >
            + Add
          </Link>
          {username ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/profile" className="text-white text-[10px] sm:text-xs font-semibold max-w-[60px] sm:max-w-none truncate">
                {username}
              </Link>
              <button onClick={handleLogout} className="text-white/70 text-[10px] sm:text-xs whitespace-nowrap">Logout</button>
            </div>
          ) : (
            <Link href="/login" className="text-white text-[10px] sm:text-xs font-semibold whitespace-nowrap">Login</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
