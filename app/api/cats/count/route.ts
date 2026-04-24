import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const revalidate = 0 // always fresh

export async function GET() {
  const { count } = await supabase
    .from('cats')
    .select('*', { count: 'exact', head: true })
    .eq('is_hidden', false)
    .eq('is_approved', true)

  return NextResponse.json({ count: count ?? 0 })
}
