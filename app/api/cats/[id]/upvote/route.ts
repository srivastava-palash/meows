import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getVoterId, setVoterCookie } from '@/lib/voter'

// GET — check if caller has upvoted this cat (also returns current count for hydration)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const voterId = getVoterId(req)

  const [{ data: vote }, { data: cat }] = await Promise.all([
    supabase.from('cat_upvotes').select('id').eq('cat_id', params.id).eq('ip', voterId).maybeSingle(),
    supabase.from('cats').select('upvote_count').eq('id', params.id).single(),
  ])

  return NextResponse.json({ upvoted: !!vote, count: cat?.upvote_count ?? 0 })
}

// POST — toggle upvote
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const voterId = getVoterId(req)
  const session = await getSession()
  const user_id = session.userId ?? null

  // Check existing vote by voter ID
  const { data: existing } = await supabase
    .from('cat_upvotes')
    .select('id')
    .eq('cat_id', params.id)
    .eq('ip', voterId)
    .maybeSingle()

  if (existing) {
    await supabase.from('cat_upvotes').delete().eq('id', existing.id)
  } else {
    await supabase.from('cat_upvotes').insert({ cat_id: params.id, ip: voterId, user_id })
  }

  // Return fresh count (trigger has already updated it)
  const { data: cat } = await supabase
    .from('cats')
    .select('upvote_count')
    .eq('id', params.id)
    .single()

  const res = NextResponse.json({
    upvoted: !existing,
    count: cat?.upvote_count ?? 0,
  })

  // Persist voter UUID as HTTP-only cookie so it survives localStorage clears
  setVoterCookie(res, voterId)
  return res
}
