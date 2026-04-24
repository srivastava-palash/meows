'use client'
import { useState } from 'react'
import Link from 'next/link'

interface FlaggedCat {
  id: string; thumbnail_url: string; name: string | null
  location_name: string | null; report_count: number; is_hidden: boolean; created_at: string
}
interface FlaggedComment {
  id: string; text: string; author_name: string | null
  report_count: number; is_hidden: boolean; cat_id: string; created_at: string
}

export default function AdminControls({
  flaggedCats, flaggedComments,
}: { flaggedCats: FlaggedCat[]; flaggedComments: FlaggedComment[] }) {
  const [cats, setCats] = useState(flaggedCats)
  const [comments, setComments] = useState(flaggedComments)

  async function toggleCat(id: string, hide: boolean) {
    await fetch(`/api/admin/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cat', id, is_hidden: hide }),
    })
    setCats(prev => prev.map(c => c.id === id ? { ...c, is_hidden: hide } : c))
  }

  async function toggleComment(id: string, hide: boolean) {
    await fetch(`/api/admin/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'comment', id, is_hidden: hide }),
    })
    setComments(prev => prev.map(c => c.id === id ? { ...c, is_hidden: hide } : c))
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold mb-3">Flagged Cats ({cats.length})</h2>
        {cats.length === 0 && <p className="text-gray-400 text-sm">No flagged cats.</p>}
        <div className="space-y-3">
          {cats.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 bg-white border rounded-xl p-3">
              <img src={cat.thumbnail_url} className="w-12 h-12 rounded-lg object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <Link href={`/cats/${cat.id}`} className="text-sm font-semibold text-gray-900 hover:text-[#ff6b35]">
                  {cat.name ?? cat.location_name ?? 'Unknown'} — {cat.report_count} reports
                </Link>
                <p className="text-xs text-gray-400">{new Date(cat.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${cat.is_hidden ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {cat.is_hidden ? 'Hidden' : 'Visible'}
              </span>
              <button
                onClick={() => toggleCat(cat.id, !cat.is_hidden)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
              >
                {cat.is_hidden ? 'Restore' : 'Hide'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Flagged Comments ({comments.length})</h2>
        {comments.length === 0 && <p className="text-gray-400 text-sm">No flagged comments.</p>}
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-3 bg-white border rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 line-clamp-2">{c.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.author_name ?? 'anonymous'} · {c.report_count} reports ·{' '}
                  <Link href={`/cats/${c.cat_id}`} className="text-[#ff6b35]">View cat</Link>
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${c.is_hidden ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {c.is_hidden ? 'Hidden' : 'Visible'}
              </span>
              <button
                onClick={() => toggleComment(c.id, !c.is_hidden)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg shrink-0"
              >
                {c.is_hidden ? 'Restore' : 'Hide'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
