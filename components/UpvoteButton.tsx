'use client'
import { useState, useEffect } from 'react'

interface Props {
  catId: string
  initialCount: number
}

/** Get or create a stable anonymous voter UUID stored in localStorage. */
function getVoterId(): string {
  const key = 'meows_voter'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

/** Headers to send on every upvote request so the server can match the voter. */
function voterHeaders(): Record<string, string> {
  try {
    return { 'x-voter-id': getVoterId() }
  } catch {
    return {} // SSR / localStorage unavailable
  }
}

export default function UpvoteButton({ catId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const [upvoted, setUpvoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  // Check upvoted state AND sync real count from server (fixes SSR stale 0)
  useEffect(() => {
    fetch(`/api/cats/${catId}/upvote`, { headers: voterHeaders() })
      .then(r => r.json())
      .then(d => {
        setUpvoted(d.upvoted)
        setCount(d.count)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [catId])

  async function toggle() {
    if (loading) return
    setLoading(true)

    // Optimistic update
    setUpvoted(u => !u)
    setCount(c => upvoted ? c - 1 : c + 1)

    const res = await fetch(`/api/cats/${catId}/upvote`, {
      method: 'POST',
      headers: voterHeaders(),
    })
    setLoading(false)
    if (res.ok) {
      const d = await res.json()
      setUpvoted(d.upvoted)
      setCount(d.count)
    } else {
      // Revert on error
      setUpvoted(u => !u)
      setCount(c => upvoted ? c + 1 : c - 1)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={!checked}
      aria-label={upvoted ? 'Remove upvote' : 'Upvote this cat'}
      className="flex items-center gap-2 group"
    >
      <span
        className={`text-3xl transition-transform duration-150 ${
          loading ? 'opacity-50' : 'group-hover:scale-110'
        } ${upvoted ? 'scale-110' : ''}`}
        style={{ filter: upvoted ? 'none' : 'grayscale(1)' }}
      >
        ❤️
      </span>
      <span className={`text-sm font-bold ${upvoted ? 'text-[#ff6b35]' : 'text-gray-400'}`}>
        {count} {count === 1 ? 'love' : 'loves'}
      </span>
    </button>
  )
}
