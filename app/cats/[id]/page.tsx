import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { Cat, CatPhoto, Comment } from '@/types'
import CommentSection from '@/components/CommentSection'
import ReportButton from '@/components/ReportButton'
import UpvoteButton from '@/components/UpvoteButton'
import Link from 'next/link'
import PhotoGallery from '@/components/PhotoGallery'
import EditLocationButton from '@/components/EditLocationButton'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

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
  // Fetch cat + additional photos in parallel
  const [catResult, extrasResult] = await Promise.all([
    supabase
      .from('cats')
      .select('*')
      .eq('id', params.id)
      .eq('is_hidden', false)
      .single(),
    supabase
      .from('cat_photos')
      .select('*')
      .eq('cat_id', params.id)
      .order('display_order', { ascending: true }),
  ])

  const cat = catResult.data as Cat | null
  const extraPhotos = extrasResult.data as CatPhoto[] | null

  if (!cat) notFound()

  const session = await getSession()
  const isAdmin = !!session.userId
  const cookieStore = await cookies()
  const isAdminCookie = cookieStore.get('admin-auth')?.value === process.env.ADMIN_PASSWORD
  const canEditLocation =
    isAdminCookie ||
    (session.userId != null &&
      (cat.user_id === null || cat.user_id === session.userId))
  const comments = await getComments(params.id)
  const allPhotos: string[] = [
    cat.photo_url,
    ...((extraPhotos ?? []).map(p => p.photo_url)),
  ]

  return (
    <main className="max-w-lg mx-auto pb-16">
      <Link href="/" className="flex items-center gap-2 px-4 py-3 text-[#ff6b35] text-sm font-semibold">
        ← Back to map
      </Link>

      {/* Photo gallery — shows carousel if multiple, single image if only one */}
      <PhotoGallery photos={allPhotos} alt={cat.name ?? 'A stray cat'} />

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

        {/* Upvote + Report */}
        <div className="flex items-center justify-between mb-4">
          <UpvoteButton catId={cat.id} initialCount={cat.upvote_count ?? 0} />
          <ReportButton id={cat.id} type="cat" />
        </div>

        {/* Move pin — visible to owner / admin */}
        {canEditLocation && (
          <div className="mb-4">
            <EditLocationButton
              catId={cat.id}
              initialLat={cat.lat}
              initialLng={cat.lng}
              initialLocationName={cat.location_name}
            />
          </div>
        )}

        <hr className="my-5 border-gray-100" />

        <CommentSection catId={cat.id} initialComments={comments} isAdmin={isAdmin} />
      </div>
    </main>
  )
}
