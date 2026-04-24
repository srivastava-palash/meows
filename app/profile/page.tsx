import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/db'
import type { Cat, Comment } from '@/types'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const [{ data: cats }, { data: comments }] = await Promise.all([
    supabase
      .from('cats')
      .select('id, thumbnail_url, name, location_name, created_at')
      .eq('user_id', session.userId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('comments')
      .select('id, text, cat_id, created_at')
      .eq('user_id', session.userId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">My contributions</h1>
      <p className="text-sm text-gray-400 mb-6">{session.username}</p>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">🐾 Cats I&apos;ve added ({cats?.length ?? 0})</h2>
        {cats?.length === 0 && (
          <p className="text-sm text-gray-400">You haven&apos;t added any cats yet. <Link href="/add" className="text-[#ff6b35]">Add one!</Link></p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {(cats ?? []).map((cat: Pick<Cat, 'id' | 'thumbnail_url' | 'name' | 'location_name' | 'created_at'>) => (
            <Link key={cat.id} href={`/cats/${cat.id}`}>
              <div className="aspect-square rounded-xl overflow-hidden bg-[#ffd6b3] relative">
                <img src={cat.thumbnail_url} alt={cat.name ?? ''} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-gray-600 mt-1 truncate">{cat.name ?? cat.location_name ?? 'Unknown'}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-700 mb-3">💬 My comments ({comments?.length ?? 0})</h2>
        {comments?.length === 0 && (
          <p className="text-sm text-gray-400">No comments yet.</p>
        )}
        <div className="space-y-3">
          {(comments ?? []).map((c: Pick<Comment, 'id' | 'text' | 'cat_id' | 'created_at'>) => (
            <Link key={c.id} href={`/cats/${c.cat_id}`} className="block bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-sm text-gray-700 line-clamp-2">{c.text}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
