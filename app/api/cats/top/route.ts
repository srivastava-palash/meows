import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const revalidate = 60 // 1-minute cache — upvote counts shift slowly

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 10), 50)

  const { data, error } = await supabase
    .from('cats')
    .select('id, name, thumbnail_url, location_name, upvote_count, created_at')
    .eq('is_hidden', false)
    .eq('is_approved', true)
    .order('upvote_count', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
