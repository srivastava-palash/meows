'use client'
import { useState } from 'react'
import type { Comment } from '@/types'
import CommentForm from './CommentForm'

function CommentItem({ comment, catId }: { comment: Comment; catId: string }) {
  const [showReply, setShowReply] = useState(false)
  const [reported, setReported] = useState(false)

  async function handleReport() {
    await fetch(`/api/comments/${comment.id}/report`, { method: 'POST', body: JSON.stringify({}) })
    setReported(true)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-[#ffd6b3] flex items-center justify-center text-xs">🐾</div>
        <span className="text-xs font-semibold text-gray-600">{comment.author_name ?? 'anonymous'}</span>
        <span className="text-xs text-gray-400">· {new Date(comment.created_at).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed pl-8">{comment.text}</p>
      <div className="flex gap-3 pl-8 mt-1">
        <button onClick={() => setShowReply(v => !v)} className="text-xs text-[#ff6b35]">
          ↩ Reply
        </button>
        {!reported && (
          <button onClick={handleReport} className="text-xs text-gray-400">🚩 Report</button>
        )}
        {reported && <span className="text-xs text-gray-400">Reported</span>}
      </div>
      {showReply && (
        <div className="pl-8 mt-2">
          <CommentForm catId={catId} parentId={comment.id} onSubmit={() => setShowReply(false)} compact />
        </div>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-8 mt-3 border-l-2 border-[#ffe0cc]">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} catId={catId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentThread({ comments, catId }: { comments: Comment[]; catId: string }) {
  return (
    <div>
      {comments.map(c => <CommentItem key={c.id} comment={c} catId={catId} />)}
    </div>
  )
}
