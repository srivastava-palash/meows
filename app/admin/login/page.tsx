'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push('/admin') } else { setError(true) }
  }

  return (
    <main className="max-w-xs mx-auto px-4 py-20">
      <h1 className="text-xl font-bold mb-4">Admin Login</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Admin password"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {error && <p className="text-red-500 text-xs">Wrong password</p>}
        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2 rounded-lg">
          Enter
        </button>
      </form>
    </main>
  )
}
