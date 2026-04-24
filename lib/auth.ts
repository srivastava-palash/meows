import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/types'

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'meows-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession()
  if (!session.userId) {
    throw new Error('Unauthorized')
  }
  return { userId: session.userId, username: session.username }
}
