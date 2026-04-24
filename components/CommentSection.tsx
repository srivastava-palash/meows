'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Comment } from '@/types'
import CommentThread from './CommentThread'
import CommentForm from './CommentForm'

type SortMode = 'newest' | 'best'

interface Props {
  catId: string
  initialComments: Comment[]
}

export default function CommentSection({ catId, initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [sort, setSort] = useState<SortMode>('newest')
  const router = useRouter()

  // Sort a copy — never mutate state directly
  const sorted = useMemo(() => {
    const arr = [...comments]
    if (sort === 'best') arr.sort((a, b) => (b.upvote_count ?? 0) - (a.upvote_count ?? 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return arr
  }, [comments, sort])

  function handleNewComment(comment: Comment) {
    setComments(prev => [...prev, { ...comment, replies: [], upvote_count: 0 }])
    router.refresh()
  }

  function handleDeleteComment(id: string) {
    setComments(prev => prev.filter(c => c.id !== id))
    router.refresh()
  }

  function handleUpvoteComment(id: string, newCount: number) {
    setComments(prev => prev.map(c => c.id === id ? { ...c, upvote_count: newCount } : c))
  }

  const btnBase: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, padding: '4px 12px',
    borderRadius: 999, border: 'none', cursor: 'pointer',
    transition: 'all 0.15s',
  }

  return (
    <>
      {/* Header + sort toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
          💬 Community ({comments.length} comment{comments.length !== 1 ? 's' : ''})
        </h2>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 999, padding: 3, gap: 2 }}>
          {(['newest', 'best'] as SortMode[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                ...btnBase,
                background: sort === s ? 'white' : 'transparent',
                color: sort === s ? '#ff6b35' : '#6b7280',
                boxShadow: sort === s ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {s === 'newest' ? '🕐 Newest' : '▲ Best'}
            </button>
          ))}
        </div>
      </div>

      <CommentThread
        comments={sorted}
        catId={catId}
        onNewComment={handleNewComment}
        onDeleteComment={handleDeleteComment}
        onUpvoteComment={handleUpvoteComment}
      />

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Add a comment</h3>
      <CommentForm catId={catId} onSubmit={handleNewComment} />
    </>
  )
}
