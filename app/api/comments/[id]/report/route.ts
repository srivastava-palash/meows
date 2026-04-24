import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const AUTO_HIDE_THRESHOLD = 5

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json().catch(() => ({ reason: null }))

  await supabase.from('reports').insert({
    target_type: 'comment',
    target_id: params.id,
    reason: reason ?? null,
  })

  const { data } = await supabase
    .from('comments')
    .select('report_count')
    .eq('id', params.id)
    .single()

  const newCount = (data?.report_count ?? 0) + 1
  const update: Record<string, unknown> = { report_count: newCount }
  if (newCount >= AUTO_HIDE_THRESHOLD) update.is_hidden = true

  await supabase.from('comments').update(update).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
