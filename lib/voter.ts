import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

const VOTER_COOKIE = 'meows_voter'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Get the voter identity for this request.
 * Priority: HTTP-only cookie → X-Voter-Id header → fresh server UUID.
 *
 * The cookie is stamped on every GET and POST response (see upvote/route.ts),
 * so identity is locked in from the first page load — not just after first vote.
 * This prevents re-voting when localStorage is cleared but the cookie persists.
 */
export function getVoterId(req: NextRequest): string {
  const cookie = req.cookies.get(VOTER_COOKIE)?.value
  if (cookie && UUID_RE.test(cookie)) return cookie

  const header = req.headers.get('x-voter-id')
  if (header && UUID_RE.test(header)) return header

  // No existing identity → mint a fresh UUID.
  // The caller MUST stamp this as a cookie in the response so the browser keeps it.
  return randomUUID()
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
