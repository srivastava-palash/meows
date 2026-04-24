'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Login failed')
      return
    }
    window.location.href = '/'
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-400 mt-4">
        No account? <Link href="/signup" className="text-[#ff6b35] font-semibold">Sign up</Link>
      </p>
      <p className="text-center text-sm text-gray-400 mt-2">
        <Link href="/reset-password" className="text-[#ff6b35]">Forgot password?</Link>
      </p>
    </main>
  )
}
