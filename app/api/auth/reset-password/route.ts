import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, email, newPassword } = await req.json()

  if (!username || !email || !newPassword) {
    return NextResponse.json({ error: 'Username, email, and new password are required' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  // Look up by username — then verify email matches
  // Using generic error to avoid leaking which field is wrong
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email')
    .eq('username', username)
    .single()

  const emailMatches = data?.email &&
    data.email.toLowerCase() === email.trim().toLowerCase()

  if (error || !data || !emailMatches) {
    return NextResponse.json(
      { error: 'Username and email don\'t match any account' },
      { status: 401 }
    )
  }

  // Update password
  const password_hash = await bcrypt.hash(newPassword, 10)
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', data.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }

  // Set session so user is logged in after reset
  const session = await getSession()
  session.userId = data.id
  session.username = data.username
  await session.save()

  return NextResponse.json({ username: data.username })
}
