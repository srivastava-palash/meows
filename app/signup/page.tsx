'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Signup failed')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Create account</h1>
      <p className="text-sm text-gray-400 mb-6">Username and password only — no email needed.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="letters, numbers, underscores"
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
            placeholder="at least 6 characters"
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
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-400 mt-4">
        Already have an account? <Link href="/login" className="text-[#ff6b35] font-semibold">Log in</Link>
      </p>
    </main>
  )
}
