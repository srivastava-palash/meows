import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/db'

// GET — fetch a single cat (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE — permanently remove a cat + its storage files (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin-auth')?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch photo paths before deleting the row
  const { data: cat } = await supabase
    .from('cats')
    .select('photo_url, thumbnail_url')
    .eq('id', params.id)
    .single()

  // Delete from DB (cascade removes upvotes, comments, reports)
  const { error } = await supabase.from('cats').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  // Best-effort: remove storage objects
  if (cat) {
    const toKey = (url: string) => url.split('/cat-photos/')[1]
    const keys = [cat.photo_url, cat.thumbnail_url]
      .filter(Boolean)
      .map(toKey)
      .filter(Boolean)
    if (keys.length) {
      await supabase.storage.from('cat-photos').remove(keys)
    }
  }

  return NextResponse.json({ ok: true })
}
