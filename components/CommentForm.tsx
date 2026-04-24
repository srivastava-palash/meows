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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#111827',           /* ← explicit dark text */
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!compact && (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = '#ff6b35')}
          onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
        />
      )}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={compact ? 'Write a reply…' : 'Share what you know about this cat…'}
        required
        style={{
          ...inputStyle,
          height: compact ? 68 : 88,
          resize: 'none',
          lineHeight: 1.5,
        }}
        onFocus={e => (e.currentTarget.style.borderColor = '#ff6b35')}
        onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
      />
      {error && (
        <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>⚠️ {error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !text.trim()}
        style={{
          background: loading || !text.trim() ? '#ffd4bc' : '#ff6b35',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          padding: '10px 0',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {loading ? 'Posting…' : compact ? 'Reply' : 'Post comment'}
      </button>
    </form>
  )
}
