import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { validateBbox, roundCoord } from '@/lib/geo'
import { getSession } from '@/lib/auth'
import type { CatPin, UploadResult } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bbox = validateBbox(
    searchParams.get('swLat') ?? '',
    searchParams.get('swLng') ?? '',
    searchParams.get('neLat') ?? '',
    searchParams.get('neLng') ?? ''
  )

  if (!bbox) {
    return NextResponse.json({ error: 'Invalid bounding box parameters' }, { status: 400 })
  }

  const sort_by = searchParams.get('sort') === 'loved' ? 'loved' : 'recent'

  const { data, error } = await supabase.rpc('cats_in_bbox', {
    sw_lat: bbox.swLat,
    sw_lng: bbox.swLng,
    ne_lat: bbox.neLat,
    ne_lng: bbox.neLng,
    sort_by,
  })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const pins: CatPin[] = (data ?? []).map((row: CatPin) => ({
    ...row,
    lat: roundCoord(row.lat),
    lng: roundCoord(row.lng),
  }))

  return NextResponse.json(pins)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    photo_url, thumbnail_url, photo_width, photo_height,
    lat, lng, location_name, name, story, last_seen_at,
    additional_photos,
  } = body

  if (!photo_url || !thumbnail_url || lat == null || lng == null) {
    return NextResponse.json({ error: 'photo_url, thumbnail_url, lat, and lng are required' }, { status: 400 })
  }

  const session = await getSession()
  const user_id = session.userId ?? null

  const { data, error } = await supabase
    .from('cats')
    .insert({
      photo_url,
      thumbnail_url,
      photo_width: photo_width ?? 0,
      photo_height: photo_height ?? 0,
      lat,
      lng,
      location: `POINT(${lng} ${lat})`,
      location_name: location_name ?? null,
      name: name || null,
      story: story || null,
      last_seen_at: last_seen_at || null,
      user_id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save cat' }, { status: 500 })

  // Insert additional photos if provided
  if (Array.isArray(additional_photos) && additional_photos.length > 0) {
    const extras = additional_photos.map((p: UploadResult, i: number) => ({
      cat_id: data.id,
      photo_url: p.photo_url,
      thumbnail_url: p.thumbnail_url,
      photo_width: p.photo_width ?? 0,
      photo_height: p.photo_height ?? 0,
      display_order: i + 1,
    }))
    await supabase.from('cat_photos').insert(extras)
    // Non-fatal — main cat already saved
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
