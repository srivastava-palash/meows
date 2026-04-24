import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/db'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin-auth')?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, id, is_hidden } = await req.json()
  const table = type === 'cat' ? 'cats' : 'comments'

  const { error } = await supabase.from(table).update({ is_hidden }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
