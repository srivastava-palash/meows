import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import type { Cat } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Cat not found' }, { status: 404 })
  }

  return NextResponse.json(data as Cat)
}
