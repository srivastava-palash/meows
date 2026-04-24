'use client'
import { useState } from 'react'
import type { Comment } from '@/types'

interface Props {
  catId: string
  parentId?: string
  onSubmit?: (comment: Comment) => void
  compact?: boolean
}

export default function CommentForm({ catId, parentId, onSubmit, compact }: Props) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat_id: catId, text, author_name: name || null, parent_id: parentId ?? null }),
    })

    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to post')
      return
    }

    const comment: Comment = await res.json()
    setText('')
    setName('')
    onSubmit?.(comment)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {!compact && (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
        />
      )}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={compact ? 'Write a reply…' : 'Share what you know about this cat…'}
        className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2 text-sm bg-[#fffaf8] h-20 resize-none focus:outline-none focus:border-[#ff6b35]"
        required
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#ff6b35] text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Posting…' : compact ? 'Reply' : 'Post comment'}
      </button>
    </form>
  )
}
