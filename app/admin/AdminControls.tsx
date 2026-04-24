'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CatRow {
  id: string; thumbnail_url: string; name: string | null
  location_name: string | null; report_count: number; is_hidden: boolean; created_at: string
}
interface FlaggedComment {
  id: string; text: string; author_name: string | null
  report_count: number; is_hidden: boolean; cat_id: string; created_at: string
}

function CatCard({ cat, onToggle, onDelete, deleting, highlighted = false }: {
  cat: CatRow
  onToggle: (id: string, hide: boolean) => void
  onDelete: (id: string) => void
  deleting: string | null
  highlighted?: boolean
}) {
  return (
    <div style={{
      background: highlighted ? '#fffbeb' : 'white',
      border: cat.is_hidden
        ? '1.5px solid #fca5a5'
        : highlighted
          ? '1.5px solid #fcd34d'
          : '1.5px solid #e5e7eb',
      borderLeft: highlighted ? '4px solid #f59e0b' : undefined,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cat.thumbnail_url}
        alt=""
        style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/cats/${cat.id}`} style={{ fontWeight: 600, fontSize: 14, color: '#111', textDecoration: 'none' }}>
          {cat.name ?? cat.location_name ?? 'Unnamed cat'}
        </Link>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {new Date(cat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {cat.report_count > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: '#fef2f2', color: '#dc2626',
              padding: '2px 8px', borderRadius: 999,
            }}>
              🚩 {cat.report_count} report{cat.report_count !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: cat.is_hidden ? '#fef2f2' : '#f0fdf4',
            color: cat.is_hidden ? '#dc2626' : '#16a34a',
            padding: '2px 8px', borderRadius: 999,
          }}>
            {cat.is_hidden ? 'Hidden' : 'Visible'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onToggle(cat.id, !cat.is_hidden)}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px',
            borderRadius: 8, border: '1.5px solid #e5e7eb',
            background: 'white', color: '#374151', cursor: 'pointer',
          }}
        >
          {cat.is_hidden ? 'Restore' : 'Hide'}
        </button>
        <button
          onClick={() => onDelete(cat.id)}
          disabled={deleting === cat.id}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px',
            borderRadius: 8, border: 'none',
            background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
            opacity: deleting === cat.id ? 0.5 : 1,
          }}
        >
          {deleting === cat.id ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export default function AdminControls({
  flaggedCats, flaggedComments,
}: { flaggedCats: CatRow[]; flaggedComments: FlaggedComment[] }) {
  const router = useRouter()
  const [cats, setCats] = useState(flaggedCats)
  const [comments, setComments] = useState(flaggedComments)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function toggleCat(id: string, hide: boolean) {
    await fetch('/api/admin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cat', id, is_hidden: hide }),
    })
    setCats(prev => prev.map(c => c.id === id ? { ...c, is_hidden: hide } : c))
  }

  async function deleteCat(id: string) {
    if (!confirm('Permanently delete this cat and its photos? This cannot be undone.')) return
    setDeleting(id)
    const res = await fetch(`/api/cats/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCats(prev => prev.filter(c => c.id !== id))
      router.refresh()
    } else {
      alert('Delete failed')
    }
    setDeleting(null)
  }

  async function toggleComment(id: string, hide: boolean) {
    await fetch('/api/admin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'comment', id, is_hidden: hide }),
    })
    setComments(prev => prev.map(c => c.id === id ? { ...c, is_hidden: hide } : c))
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 40 }}>

      {/* ── Needs Review ── */}
      {(() => {
        const flagged = cats.filter(c => c.report_count > 0)
        if (flagged.length === 0) return null
        return (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#b45309' }}>⚠️ Needs Review</h2>
              <span style={{
                fontSize: 12, fontWeight: 700,
                background: '#fef3c7', color: '#b45309',
                padding: '2px 10px', borderRadius: 999,
              }}>{flagged.length} reported</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {flagged.map(cat => (
                <CatCard key={cat.id} cat={cat} onToggle={toggleCat} onDelete={deleteCat} deleting={deleting} highlighted />
              ))}
            </div>
          </section>
        )
      })()}

      {/* ── All Cats ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>All Cats</h2>
          <span style={{ fontSize: 13, color: '#aaa' }}>{cats.length} total</span>
        </div>
        {cats.length === 0 && <p style={{ color: '#aaa', fontSize: 14 }}>No cats yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cats.map(cat => (
            <CatCard key={cat.id} cat={cat} onToggle={toggleCat} onDelete={deleteCat} deleting={deleting} />
          ))}
        </div>
      </section>

      {/* ── Flagged Comments ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>Flagged Comments</h2>
          <span style={{ fontSize: 13, color: '#aaa' }}>{comments.length} flagged</span>
        </div>

        {comments.length === 0 && (
          <p style={{ color: '#aaa', fontSize: 14 }}>No flagged comments.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comments.map(c => (
            <div key={c.id} style={{
              background: 'white',
              border: '1.5px solid #e5e7eb',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
                  &ldquo;{c.text}&rdquo;
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {c.author_name ?? 'anonymous'}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: '#fef2f2', color: '#dc2626',
                    padding: '2px 7px', borderRadius: 999,
                  }}>
                    🚩 {c.report_count} report{c.report_count !== 1 ? 's' : ''}
                  </span>
                  <Link href={`/cats/${c.cat_id}`} style={{ fontSize: 12, color: '#ff6b35', textDecoration: 'none' }}>
                    View cat →
                  </Link>
                </div>
              </div>
              <button
                onClick={() => toggleComment(c.id, !c.is_hidden)}
                style={{
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                  padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                  background: 'white', color: '#374151', cursor: 'pointer',
                }}
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
