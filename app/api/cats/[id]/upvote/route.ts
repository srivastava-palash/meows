import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

// GET — check if caller has upvoted this cat
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req)
  const { data } = await supabase
    .from('cat_upvotes')
    .select('id')
    .eq('cat_id', params.id)
    .eq('ip', ip)
    .maybeSingle()

  return NextResponse.json({ upvoted: !!data })
}

// POST — toggle upvote
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req)
  const session = await getSession()
  const user_id = session.userId ?? null

  // Check existing vote
  const { data: existing } = await supabase
    .from('cat_upvotes')
    .select('id')
    .eq('cat_id', params.id)
    .eq('ip', ip)
    .maybeSingle()

  if (existing) {
    // Remove vote
    await supabase.from('cat_upvotes').delete().eq('id', existing.id)
  } else {
    // Add vote
    await supabase.from('cat_upvotes').insert({ cat_id: params.id, ip, user_id })
  }

  // Return fresh count from DB (trigger has already updated it)
  const { data: cat } = await supabase
    .from('cats')
    .select('upvote_count')
    .eq('id', params.id)
    .single()

  return NextResponse.json({
    upvoted: !existing,
    count: cat?.upvote_count ?? 0,
  })
}
