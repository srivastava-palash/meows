import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getVoterId, setVoterCookie } from '@/lib/voter'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const voterId = getVoterId(req)
  const commentId = params.id

  // Check if already voted
  const { data: existing } = await supabase
    .from('comment_upvotes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('voter_id', voterId)
    .maybeSingle()

  let upvoted: boolean

  if (existing) {
    // Toggle off — remove vote
    await supabase
      .from('comment_upvotes')
      .delete()
      .eq('comment_id', commentId)
      .eq('voter_id', voterId)
    upvoted = false
  } else {
    // Add vote
    await supabase
      .from('comment_upvotes')
      .insert({ comment_id: commentId, voter_id: voterId })
    upvoted = true
  }

  // Read fresh count from DB
  const { data: comment } = await supabase
    .from('comments')
    .select('upvote_count')
    .eq('id', commentId)
    .single()

  const res = NextResponse.json({ upvoted, upvote_count: comment?.upvote_count ?? 0 })
  setVoterCookie(res, voterId)
  return res
}

// GET — return current vote state for this voter
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const voterId = getVoterId(req)

  const [{ data: vote }, { data: comment }] = await Promise.all([
    supabase
      .from('comment_upvotes')
      .select('id')
      .eq('comment_id', params.id)
      .eq('voter_id', voterId)
      .maybeSingle(),
    supabase
      .from('comments')
      .select('upvote_count')
      .eq('id', params.id)
      .single(),
  ])

  const res = NextResponse.json({
    upvoted: !!vote,
    upvote_count: comment?.upvote_count ?? 0,
  })
  setVoterCookie(res, voterId)
  return res
}
