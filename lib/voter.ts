import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

const VOTER_COOKIE = 'meows_voter'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Get the voter identity for this request.
 * Priority: HTTP-only cookie → X-Voter-Id header → IP fallback.
 * The cookie is set server-side (harder to clear accidentally) and the
 * header is sent by the client from localStorage (covers first request
 * before cookie round-trip completes).
 */
export function getVoterId(req: NextRequest): string {
  const cookie = req.cookies.get(VOTER_COOKIE)?.value
  if (cookie && UUID_RE.test(cookie)) return cookie

  const header = req.headers.get('x-voter-id')
  if (header && UUID_RE.test(header)) return header

  // Last resort: IP (same-network users share this, but it's better than nothing)
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

/**
 * Persist the voter UUID as a long-lived HTTP-only cookie.
 * Call this on every upvote POST response.
 */
export function setVoterCookie(res: NextResponse, voterId: string): void {
  res.cookies.set(VOTER_COOKIE, voterId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
    path: '/',
  })
}
