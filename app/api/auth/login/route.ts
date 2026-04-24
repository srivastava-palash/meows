import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, password_hash')
    .eq('username', username)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, data.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const session = await getSession()
  session.userId = data.id
  session.username = data.username
  await session.save()

  return NextResponse.json({ username: data.username })
}
