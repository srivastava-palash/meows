import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

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

// PATCH — update cat location (owner or admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const isAdminCookie = cookieStore.get('admin-auth')?.value === process.env.ADMIN_PASSWORD
  const session = await getSession()

  // Fetch existing cat to verify ownership
  const { data: cat } = await supabase
    .from('cats')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canEdit =
    isAdminCookie ||
    (session.userId != null &&
      (cat.user_id === null || cat.user_id === session.userId))

  if (!canEdit) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lat, lng, location_name } = await req.json()
  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('cats')
    .update({
      lat,
      lng,
      location: `POINT(${lng} ${lat})`,
      location_name: location_name ?? null,
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
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
