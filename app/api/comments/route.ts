import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { cat_id, text, author_name, parent_id } = await req.json()

  if (!cat_id || !text?.trim()) {
    return NextResponse.json({ error: 'cat_id and text are required' }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Comment too long (max 2000 characters)' }, { status: 400 })
  }

  const session = await getSession()
  const user_id = session.userId ?? null
  const resolvedName = user_id ? session.username : (author_name?.trim() || null)

  const { data, error } = await supabase
    .from('comments')
    .insert({
      cat_id,
      text: text.trim(),
      author_name: resolvedName,
      user_id,
      parent_id: parent_id ?? null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
