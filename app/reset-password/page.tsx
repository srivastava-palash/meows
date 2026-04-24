'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Stage = 'verify' | 'newPassword'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('verify')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Stage 1: validate inputs locally then advance to password entry
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !email.trim()) {
      setError('Both username and email are required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setStage('newPassword')
  }

  // Stage 2: set new password
  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords don\'t match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, newPassword }),
    })
    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Reset failed')
      // If match failed, go back to verify stage
      setStage('verify')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      {stage === 'verify' ? (
        <>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Reset password</h1>
          <p className="text-sm text-gray-400 mb-6">
            Enter the username and email you signed up with. If they match, you can set a new password right here — no email will be sent.
          </p>
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
            >
              Continue →
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Choose a new password</h1>
          <p className="text-sm text-gray-400 mb-6">
            Setting a new password for <span className="font-semibold text-gray-700">{username}</span>
          </p>
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="at least 6 characters"
                required
                autoComplete="new-password"
                className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Set new password'}
            </button>
            <button
              type="button"
              onClick={() => { setStage('verify'); setError(null) }}
              className="w-full text-gray-400 text-sm py-2"
            >
              ← Back
            </button>
          </form>
        </>
      )}

      <p className="text-center text-sm text-gray-400 mt-6">
        Remember it? <Link href="/login" className="text-[#ff6b35] font-semibold">Log in</Link>
      </p>
    </main>
  )
}
