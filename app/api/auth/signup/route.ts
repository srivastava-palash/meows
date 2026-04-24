import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }
  if (username.length < 2 || username.length > 20) {
    return NextResponse.json({ error: 'Username must be 2–20 characters' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: 'Username may only contain letters, numbers, underscores' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash })
    .select('id, username')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  const session = await getSession()
  session.userId = data.id
  session.username = data.username
  await session.save()

  return NextResponse.json({ username: data.username }, { status: 201 })
}
