'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [catCount, setCatCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.username) setUsername(d.username)
    }).catch(() => {})
    fetch('/api/cats/count').then(r => r.json()).then(d => {
      if (d.count != null) setCatCount(d.count)
    }).catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUsername(null)
    router.refresh()
  }

  return (
    <nav className="bg-[#ff6b35] px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="text-white font-extrabold text-base tracking-tight">
        🐾 Meows of Mumbai
      </Link>
      <div className="flex items-center gap-3">
        {catCount != null && (
          <span className="text-white/80 text-xs hidden sm:block">{catCount} cats spotted</span>
        )}
        <Link
          href="/add"
          className="bg-white text-[#ff6b35] text-xs font-bold px-3 py-1.5 rounded-full"
        >
          + Add a Cat
        </Link>
        {username ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="text-white text-xs font-semibold">{username}</Link>
            <button onClick={handleLogout} className="text-white/70 text-xs">Logout</button>
          </div>
        ) : (
          <Link href="/login" className="text-white text-xs">Login</Link>
        )}
      </div>
    </nav>
  )
}
