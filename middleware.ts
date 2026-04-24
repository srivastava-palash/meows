import { NextRequest, NextResponse } from 'next/server'

// In-memory store — resets on cold start, good enough for MVP
// For production: replace with Upstash Redis
const counts = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = counts.get(key)

  if (!entry || now > entry.resetAt) {
    counts.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  if (entry.count > limit) return true
  return false
}

export function middleware(req: NextRequest) {
  const ip = getIp(req)
  const { pathname } = req.nextUrl

  if (pathname === '/api/cats' && req.method === 'POST') {
    if (isRateLimited(`cat:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 })
    }
  }

  if (pathname === '/api/comments' && req.method === 'POST') {
    if (isRateLimited(`comment:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many comments. Try again later.' }, { status: 429 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/cats', '/api/comments'],
}
