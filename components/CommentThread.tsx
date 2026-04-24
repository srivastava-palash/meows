'use client'
import { useState, useEffect } from 'react'
import type { Comment } from '@/types'
import CommentForm, { getMyCommentIds } from './CommentForm'

interface CommentItemProps {
  comment: Comment
  catId: string
  myIds: Set<string>
  onDelete: (id: string) => void
  onNewReply: (reply: Comment) => void
  onUpvote: (id: string, newCount: number) => void
}

function CommentItem({ comment, catId, myIds, onDelete, onNewReply, onUpvote }: CommentItemProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [replies, setReplies] = useState<Comment[]>(comment.replies ?? [])
  const [deleting, setDeleting] = useState(false)
  const [upvoted, setUpvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(comment.upvote_count ?? 0)
  const [upvoting, setUpvoting] = useState(false)
  const isOwn = myIds.has(comment.id)

  // Fetch initial vote state
  useEffect(() => {
    fetch(`/api/comments/${comment.id}/upvote`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setUpvoted(d.upvoted); setUpvoteCount(d.upvote_count) } })
  }, [comment.id])

  async function handleUpvote() {
    if (upvoting) return
    setUpvoting(true)
    // Optimistic
    const next = !upvoted
    setUpvoted(next)
    setUpvoteCount(c => c + (next ? 1 : -1))
    onUpvote(comment.id, upvoteCount + (next ? 1 : -1))
    try {
      const res = await fetch(`/api/comments/${comment.id}/upvote`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setUpvoted(d.upvoted)
        setUpvoteCount(d.upvote_count)
        onUpvote(comment.id, d.upvote_count)
      } else {
        // Revert on failure
        setUpvoted(!next)
        setUpvoteCount(c => c + (next ? -1 : 1))
      }
    } finally { setUpvoting(false) }
  }


  async function handleDelete() {
    if (!confirm('Delete your comment?')) return
    setDeleting(true)
    const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(comment.id)
    else { alert('Could not delete comment'); setDeleting(false) }
  }

  function handleReplySubmit(reply: Comment) {
    setReplies(prev => [...prev, reply]) // local only — don't propagate to top-level list
    setShowReply(false)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: collapsed ? 0 : 4 }}>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            width: 16, height: 16, borderRadius: 4,
            background: collapsed ? '#ff6b35' : '#f3f4f6',
            color: collapsed ? 'white' : '#9ca3af',
            border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {collapsed ? '+' : '−'}
        </button>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#ffd6b3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>🐾</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{comment.author_name ?? 'anonymous'}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>· {new Date(comment.created_at).toLocaleDateString()}</span>
        {isOwn && (
          <span style={{ fontSize: 10, fontWeight: 700, background: '#fff0e8', color: '#ff6b35', padding: '1px 6px', borderRadius: 999 }}>you</span>
        )}
        {/* Reply count badge — visible when collapsed */}
        {collapsed && replies.length > 0 && (
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 2 }}>
            [{replies.length} {replies.length === 1 ? 'reply' : 'replies'}]
          </span>
        )}
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <>

      {/* Text */}
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.55, margin: '0 0 6px', paddingLeft: 30 }}>{comment.text}</p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, paddingLeft: 30, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Upvote */}
        <button
          onClick={handleUpvote}
          disabled={upvoting || isOwn}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: upvoted ? 700 : 400,
            color: upvoted ? '#ff6b35' : '#9ca3af',
            background: 'none', border: 'none', cursor: isOwn ? 'default' : 'pointer',
            padding: 0, opacity: isOwn ? 0.4 : 1,
          }}
          title={isOwn ? "Can't upvote your own comment" : upvoted ? 'Remove upvote' : 'Upvote'}
        >
          ▲ {upvoteCount > 0 && <span>{upvoteCount}</span>}
        </button>

        {/* Reply */}
        <button
          onClick={() => setShowReply(v => !v)}
          style={{ fontSize: 12, color: '#ff6b35', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ↩ Reply
        </button>


        {/* Delete (own only) */}
        {isOwn && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ fontSize: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? 'Deleting…' : '🗑 Delete'}
          </button>
        )}
      </div>

      {/* Reply form */}
      {showReply && (
        <div style={{ paddingLeft: 30, marginTop: 8 }}>
          <CommentForm catId={catId} parentId={comment.id} onSubmit={handleReplySubmit} compact />
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div style={{ paddingLeft: 30, marginTop: 10, borderLeft: '2px solid #ffe0cc' }}>
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              catId={catId}
              myIds={myIds}
              onDelete={onDelete}
              onNewReply={onNewReply}
              onUpvote={onUpvote}
            />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

interface Props {
  comments: Comment[]
  catId: string
  onNewComment?: (comment: Comment) => void
  onDeleteComment?: (id: string) => void
  onUpvoteComment?: (id: string, newCount: number) => void
}

export default function CommentThread({ comments, catId, onNewComment, onDeleteComment, onUpvoteComment }: Props) {
  const [myIds, setMyIds] = useState<Set<string>>(new Set())
  useEffect(() => { setMyIds(getMyCommentIds()) }, [])

  return (
    <div>
      {comments.length === 0 && (
        <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 16 }}>No comments yet — be the first!</p>
      )}
      {comments.map(c => (
        <CommentItem
          key={c.id}
          comment={c}
          catId={catId}
          myIds={myIds}
          onDelete={onDeleteComment ?? (() => {})}
          onNewReply={onNewComment ?? (() => {})}
          onUpvote={onUpvoteComment ?? (() => {})}
        />
      ))}
    </div>
  )
}
