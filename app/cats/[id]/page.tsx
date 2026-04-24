import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/db'
import type { Cat, Comment } from '@/types'
import CommentThread from '@/components/CommentThread'
import CommentForm from '@/components/CommentForm'
import ReportButton from '@/components/ReportButton'
import Link from 'next/link'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await supabase
    .from('cats')
    .select('name, location_name, story, photo_url')
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single()

  if (!data) return { title: 'Cat not found — Meows of Mumbai' }

  const title = data.name ? `${data.name} — Meows of Mumbai` : `A cat in ${data.location_name ?? 'Mumbai'} — Meows of Mumbai`
  const description = data.story?.slice(0, 160) ?? `A stray cat spotted in ${data.location_name ?? 'Mumbai'}.`

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: data.photo_url }] },
    twitter: { card: 'summary_large_image', title, description, images: [data.photo_url] },
  }
}

async function getComments(catId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('cat_id', catId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })

  if (!data) return []

  const roots = data.filter(c => !c.parent_id)
  return roots.map(root => ({
    ...root,
    replies: data.filter(c => c.parent_id === root.id),
  }))
}

export default async function CatDetailPage({ params }: Props) {
  const { data: cat } = await supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single() as { data: Cat | null }

  if (!cat) notFound()

  const comments = await getComments(params.id)

  return (
    <main className="max-w-lg mx-auto pb-16">
      <Link href="/" className="flex items-center gap-2 px-4 py-3 text-[#ff6b35] text-sm font-semibold">
        ← Back to map
      </Link>

      {/* Photo */}
      <img
        src={cat.photo_url}
        alt={cat.name ?? 'A stray cat'}
        width={cat.photo_width}
        height={cat.photo_height}
        className="w-full max-h-80 object-cover"
      />

      <div className="px-4 pt-4">
        {/* Name + meta */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {cat.name ?? 'Unknown cat'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {cat.location_name} · {new Date(cat.created_at).toLocaleDateString()}
            </p>
          </div>
          {cat.location_name && (
            <span className="bg-[#fff0e8] text-[#ff6b35] text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              🐾 {cat.location_name}
            </span>
          )}
        </div>

        {/* Story */}
        {cat.story && (
          <blockquote className="border-l-4 border-[#ff6b35] pl-4 py-2 bg-[#fff8f5] rounded-r-lg text-sm text-gray-700 leading-relaxed mb-4 italic">
            {cat.story}
          </blockquote>
        )}

        {/* Report link */}
        <div className="mb-4">
          <ReportButton id={cat.id} type="cat" />
        </div>

        <hr className="my-5 border-gray-100" />

        {/* Comments */}
        <h2 className="text-sm font-bold text-gray-900 mb-4">
          💬 Community ({comments.length} comment{comments.length !== 1 ? 's' : ''})
        </h2>
        <CommentThread comments={comments} catId={cat.id} />

        <hr className="my-5 border-gray-100" />
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add a comment</h3>
        <CommentForm catId={cat.id} />
      </div>
    </main>
  )
}
