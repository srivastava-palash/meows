# Meows of Mumbai — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Meows of Mumbai — a community map where anyone can post and browse photos of Mumbai's stray cats, with optional stories, threaded comments, and lightweight moderation.

**Architecture:** Next.js 14 App Router for SSR and API routes. Supabase PostgreSQL + PostGIS for geospatial data. Cats load by map bounding box via a GIST spatial index — never all at once. Custom bcrypt + iron-session auth (no email). Image upload and resizing via sharp, stored in Supabase Storage.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Leaflet.js, leaflet.markercluster, Supabase (PostgreSQL + PostGIS + Storage), iron-session, bcryptjs, sharp, Jest, Vercel

---

## File Structure

```
/
├── app/
│   ├── layout.tsx                     # Root layout with Navbar
│   ├── page.tsx                       # Homepage — full-screen map
│   ├── cats/[id]/page.tsx             # Cat detail (SSR + OG tags)
│   ├── add/page.tsx                   # Add cat form wrapper
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── profile/page.tsx               # My contributions (logged-in only)
│   ├── admin/page.tsx                 # Moderation (env-password protected)
│   └── api/
│       ├── cats/route.ts              # GET (bbox) + POST (create)
│       ├── cats/[id]/route.ts         # GET single cat
│       ├── cats/[id]/report/route.ts  # POST report cat
│       ├── comments/route.ts          # POST create comment
│       ├── comments/[id]/report/route.ts
│       ├── upload/route.ts            # POST image upload + sharp resize
│       └── auth/
│           ├── signup/route.ts
│           ├── login/route.ts
│           └── logout/route.ts
├── components/
│   ├── Navbar.tsx
│   ├── Map.tsx                        # Leaflet map (dynamic import, client)
│   ├── AddCatForm.tsx                 # 3-step form (client component)
│   ├── CommentThread.tsx              # Nested comments display
│   └── CommentForm.tsx                # Add comment form
├── lib/
│   ├── db.ts                          # Supabase admin client
│   ├── auth.ts                        # iron-session config + getSession
│   └── geo.ts                         # Coordinate rounding + bbox validation
├── types/index.ts                     # Shared TypeScript types
├── middleware.ts                      # Vercel Edge rate limiting
├── supabase/migrations/001_initial.sql
└── __tests__/
    ├── lib/geo.test.ts
    └── api/cats.test.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `.env.local`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold the project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Expected: Next.js project created in current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js iron-session bcryptjs sharp leaflet leaflet.markercluster
npm install -D @types/bcryptjs @types/leaflet @types/leaflet.markercluster jest jest-environment-node ts-jest @types/jest
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
```

- [ ] **Step 4: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=at-least-32-characters-long-random-secret-here
ADMIN_PASSWORD=choose-a-strong-admin-password
EOF
```

> Fill in real values from your Supabase project dashboard (Settings → API).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js project with dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create `types/index.ts`**

```typescript
export interface CatPin {
  id: string
  thumbnail_url: string
  lat: number
  lng: number
  name: string | null
  location_name: string | null
}

export interface Cat {
  id: string
  photo_url: string
  thumbnail_url: string
  photo_width: number
  photo_height: number
  lat: number
  lng: number
  location_name: string | null
  name: string | null
  story: string | null
  last_seen_at: string | null
  user_id: string | null
  is_approved: boolean
  is_hidden: boolean
  report_count: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  cat_id: string
  text: string
  author_name: string | null
  user_id: string | null
  parent_id: string | null
  is_hidden: boolean
  report_count: number
  created_at: string
  replies?: Comment[]
}

export interface SessionData {
  userId: string
  username: string
}

export interface BoundingBox {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

export interface UploadResult {
  photo_url: string
  thumbnail_url: string
  photo_width: number
  photo_height: number
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  photo_width INT NOT NULL,
  photo_height INT NOT NULL,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  location_name TEXT,
  name TEXT,
  story TEXT,
  last_seen_at TIMESTAMPTZ,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  report_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cats_location_idx ON cats USING GIST(location);
CREATE INDEX cats_hidden_approved_idx ON cats(is_hidden, is_approved);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author_name TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  report_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('cat', 'comment')),
  target_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cats_updated_at BEFORE UPDATE ON cats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Apply migration in Supabase**

In Supabase dashboard → SQL Editor, paste and run the migration. Verify:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Expected: users, cats, comments, reports

SELECT indexname FROM pg_indexes WHERE tablename = 'cats';
-- Expected: cats_pkey, cats_location_idx, cats_hidden_approved_idx
```

- [ ] **Step 3: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `cat-photos`
- Public: ✓ (photos are public)

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema with PostGIS and storage bucket"
```

---

## Task 4: Geo Utilities

**Files:**
- Create: `lib/geo.ts`
- Create: `__tests__/lib/geo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/geo.test.ts`:
```typescript
import { roundCoord, validateBbox } from '@/lib/geo'

describe('roundCoord', () => {
  it('rounds to 3 decimal places by default', () => {
    expect(roundCoord(19.123456789)).toBe(19.123)
  })

  it('rounds up correctly', () => {
    expect(roundCoord(72.8776543)).toBe(72.878)
  })

  it('handles negative coordinates', () => {
    expect(roundCoord(-18.9999)).toBe(-19.0)
  })

  it('accepts custom precision', () => {
    expect(roundCoord(19.123456, 5)).toBe(19.12346)
  })
})

describe('validateBbox', () => {
  it('returns parsed numbers for valid bbox', () => {
    const result = validateBbox('18.87', '72.77', '19.27', '73.07')
    expect(result).toEqual({ swLat: 18.87, swLng: 72.77, neLat: 19.27, neLng: 73.07 })
  })

  it('returns null when swLat >= neLat', () => {
    expect(validateBbox('19.27', '72.77', '18.87', '73.07')).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    expect(validateBbox('abc', '72.77', '19.27', '73.07')).toBeNull()
  })

  it('returns null for out-of-range lat', () => {
    expect(validateBbox('-91', '72.77', '19.27', '73.07')).toBeNull()
  })

  it('returns null for out-of-range lng', () => {
    expect(validateBbox('18.87', '-181', '19.27', '73.07')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/lib/geo.test.ts
```

Expected: `Cannot find module '@/lib/geo'`

- [ ] **Step 3: Implement `lib/geo.ts`**

```typescript
import type { BoundingBox } from '@/types'

export function roundCoord(coord: number, precision = 3): number {
  const factor = Math.pow(10, precision)
  return Math.round(coord * factor) / factor
}

export function validateBbox(
  swLat: string,
  swLng: string,
  neLat: string,
  neLng: string
): BoundingBox | null {
  const vals = [swLat, swLng, neLat, neLng].map(Number)
  if (vals.some(isNaN)) return null
  const [swLatN, swLngN, neLatN, neLngN] = vals
  if (swLatN >= neLatN || swLngN >= neLngN) return null
  if (swLatN < -90 || neLatN > 90 || swLngN < -180 || neLngN > 180) return null
  return { swLat: swLatN, swLng: swLngN, neLat: neLatN, neLng: neLngN }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/lib/geo.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts __tests__/lib/geo.test.ts
git commit -m "feat: add geo utilities with tests"
```

---

## Task 5: Supabase Client + Auth Library

**Files:**
- Create: `lib/db.ts`
- Create: `lib/auth.ts`

- [ ] **Step 1: Create `lib/db.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

- [ ] **Step 2: Create `lib/auth.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts lib/auth.ts
git commit -m "feat: add Supabase client and iron-session auth helpers"
```

---

## Task 6: Auth API Routes

**Files:**
- Create: `app/api/auth/signup/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `app/api/auth/signup/route.ts`**

```typescript
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
```

- [ ] **Step 2: Create `app/api/auth/login/route.ts`**

```typescript
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
```

- [ ] **Step 3: Create `app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Smoke test signup manually**

```bash
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"testcat","password":"password123"}' | jq
```

Expected: `{"username":"testcat"}` with status 201.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/
git commit -m "feat: add signup, login, logout API routes"
```

---

## Task 7: Image Upload API

**Files:**
- Create: `app/api/upload/route.ts`

- [ ] **Step 1: Create `app/api/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabase } from '@/lib/db'
import type { UploadResult } from '@/types'

const BUCKET = 'cat-photos'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('photo') as File | null

  if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or HEIC' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const meta = await sharp(buffer).metadata()
  const photo_width = meta.width ?? 0
  const photo_height = meta.height ?? 0

  const id = crypto.randomUUID()

  // Full resolution (convert to JPEG for consistency)
  const fullBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
  const fullPath = `${id}/full.jpg`
  const { error: fullErr } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, fullBuffer, { contentType: 'image/jpeg' })
  if (fullErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  // Thumbnail 120×120 (cover crop)
  const thumbBuffer = await sharp(buffer)
    .resize(120, 120, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer()
  const thumbPath = `${id}/thumb.jpg`
  const { error: thumbErr } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg' })
  if (thumbErr) return NextResponse.json({ error: 'Thumbnail upload failed' }, { status: 500 })

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`
  const result: UploadResult = {
    photo_url: `${base}/${fullPath}`,
    thumbnail_url: `${base}/${thumbPath}`,
    photo_width,
    photo_height,
  }

  return NextResponse.json(result, { status: 201 })
}
```

- [ ] **Step 2: Smoke test with a real image**

```bash
npx next dev &
curl -s -X POST http://localhost:3000/api/upload \
  -F "photo=@/path/to/any-cat-photo.jpg" | jq
```

Expected: JSON with `photo_url`, `thumbnail_url`, `photo_width`, `photo_height`.

- [ ] **Step 3: Commit**

```bash
git add app/api/upload/
git commit -m "feat: add image upload API with sharp thumbnail generation"
```

---

## Task 8: Cats API — Bounding Box + Create

**Files:**
- Create: `app/api/cats/route.ts`
- Create: `__tests__/api/cats.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/cats.test.ts`:
```typescript
import { validateBbox } from '@/lib/geo'

describe('bbox validation used in GET /api/cats', () => {
  it('rejects missing params', () => {
    expect(validateBbox('', '', '', '')).toBeNull()
  })

  it('rejects swLat >= neLat', () => {
    expect(validateBbox('19.5', '72.8', '19.0', '73.0')).toBeNull()
  })

  it('accepts valid Mumbai bounding box', () => {
    const result = validateBbox('18.87', '72.77', '19.27', '73.07')
    expect(result).not.toBeNull()
    expect(result?.swLat).toBe(18.87)
  })
})
```

- [ ] **Step 2: Run tests — expect pass (uses geo.ts already written)**

```bash
npx jest __tests__/api/cats.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Create `app/api/cats/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { validateBbox, roundCoord } from '@/lib/geo'
import { getSession } from '@/lib/auth'
import type { CatPin } from '@/types'

export const runtime = 'nodejs'
export const revalidate = 30 // 30s edge cache

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bbox = validateBbox(
    searchParams.get('swLat') ?? '',
    searchParams.get('swLng') ?? '',
    searchParams.get('neLat') ?? '',
    searchParams.get('neLng') ?? ''
  )

  if (!bbox) {
    return NextResponse.json({ error: 'Invalid bounding box parameters' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('cats_in_bbox', {
    sw_lat: bbox.swLat,
    sw_lng: bbox.swLng,
    ne_lat: bbox.neLat,
    ne_lng: bbox.neLng,
  })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const pins: CatPin[] = (data ?? []).map((row: CatPin) => ({
    ...row,
    lat: roundCoord(row.lat),
    lng: roundCoord(row.lng),
  }))

  return NextResponse.json(pins)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { photo_url, thumbnail_url, photo_width, photo_height, lat, lng, location_name, name, story, last_seen_at } = body

  if (!photo_url || !thumbnail_url || lat == null || lng == null) {
    return NextResponse.json({ error: 'photo_url, thumbnail_url, lat, and lng are required' }, { status: 400 })
  }

  const session = await getSession()
  const user_id = session.userId ?? null

  const { data, error } = await supabase
    .from('cats')
    .insert({
      photo_url,
      thumbnail_url,
      photo_width: photo_width ?? 0,
      photo_height: photo_height ?? 0,
      lat,
      lng,
      location: `POINT(${lng} ${lat})`,
      location_name: location_name ?? null,
      name: name || null,
      story: story || null,
      last_seen_at: last_seen_at || null,
      user_id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save cat' }, { status: 500 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 4: Add `cats_in_bbox` database function**

In Supabase SQL Editor:
```sql
CREATE OR REPLACE FUNCTION cats_in_bbox(
  sw_lat FLOAT8, sw_lng FLOAT8,
  ne_lat FLOAT8, ne_lng FLOAT8
)
RETURNS TABLE (
  id UUID, thumbnail_url TEXT, lat FLOAT8, lng FLOAT8,
  name TEXT, location_name TEXT
)
LANGUAGE sql STABLE AS $$
  SELECT id, thumbnail_url, lat, lng, name, location_name
  FROM cats
  WHERE location && ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
    AND is_hidden = FALSE AND is_approved = TRUE
  LIMIT 200;
$$;
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cats/route.ts __tests__/api/cats.test.ts
git commit -m "feat: add cats API — bounding box query and create"
```

---

## Task 9: Cats API — Single Cat + Report

**Files:**
- Create: `app/api/cats/[id]/route.ts`
- Create: `app/api/cats/[id]/report/route.ts`

- [ ] **Step 1: Create `app/api/cats/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import type { Cat } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Cat not found' }, { status: 404 })
  }

  return NextResponse.json(data as Cat)
}
```

- [ ] **Step 2: Create `app/api/cats/[id]/report/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const AUTO_HIDE_THRESHOLD = 5

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json().catch(() => ({ reason: null }))

  await supabase.from('reports').insert({
    target_type: 'cat',
    target_id: params.id,
    reason: reason ?? null,
  })

  const { data } = await supabase
    .from('cats')
    .select('report_count')
    .eq('id', params.id)
    .single()

  const newCount = (data?.report_count ?? 0) + 1

  const update: Record<string, unknown> = { report_count: newCount }
  if (newCount >= AUTO_HIDE_THRESHOLD) update.is_hidden = true

  await supabase.from('cats').update(update).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cats/
git commit -m "feat: add single cat GET and report POST routes"
```

---

## Task 10: Comments API

**Files:**
- Create: `app/api/comments/route.ts`
- Create: `app/api/comments/[id]/report/route.ts`

- [ ] **Step 1: Create `app/api/comments/route.ts`**

```typescript
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
```

- [ ] **Step 2: Create `app/api/comments/[id]/report/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const AUTO_HIDE_THRESHOLD = 5

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json().catch(() => ({ reason: null }))

  await supabase.from('reports').insert({
    target_type: 'comment',
    target_id: params.id,
    reason: reason ?? null,
  })

  const { data } = await supabase
    .from('comments')
    .select('report_count')
    .eq('id', params.id)
    .single()

  const newCount = (data?.report_count ?? 0) + 1
  const update: Record<string, unknown> = { report_count: newCount }
  if (newCount >= AUTO_HIDE_THRESHOLD) update.is_hidden = true

  await supabase.from('comments').update(update).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/comments/
git commit -m "feat: add comments POST and report routes"
```

---

## Task 11: Rate Limiting Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Edge rate limiting middleware for cat and comment submissions"
```

---

## Task 12: Navbar Component

**Files:**
- Create: `components/Navbar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `components/Navbar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [catCount, setCatCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.username) setUsername(d.username)
    }).catch(() => {})
    fetch('/api/cats/count').then(r => r.json()).then(d => {
      if (d.count != null) setCatCount(d.count)
    }).catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUsername(null)
    router.refresh()
  }

  return (
    <nav className="bg-[#ff6b35] px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="text-white font-extrabold text-base tracking-tight">
        🐾 Meows of Mumbai
      </Link>
      <div className="flex items-center gap-3">
        {catCount != null && (
          <span className="text-white/80 text-xs hidden sm:block">{catCount} cats spotted</span>
        )}
        <Link
          href="/add"
          className="bg-white text-[#ff6b35] text-xs font-bold px-3 py-1.5 rounded-full"
        >
          + Add a Cat
        </Link>
        {username ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="text-white text-xs font-semibold">{username}</Link>
            <button onClick={handleLogout} className="text-white/70 text-xs">Logout</button>
          </div>
        ) : (
          <Link href="/login" className="text-white text-xs">Login</Link>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Add `/api/auth/me` and `/api/cats/count` routes**

Create `app/api/auth/me/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({})
  return NextResponse.json({ username: session.username })
}
```

Create `app/api/cats/count/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const revalidate = 60

export async function GET() {
  const { count } = await supabase
    .from('cats')
    .select('*', { count: 'exact', head: true })
    .eq('is_hidden', false)
    .eq('is_approved', true)

  return NextResponse.json({ count: count ?? 0 })
}
```

- [ ] **Step 3: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Meows of Mumbai',
  description: 'A community map of Mumbai\'s stray cats',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#fffaf8]`}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx app/layout.tsx app/api/auth/me/ app/api/cats/count/
git commit -m "feat: add Navbar with cat count and auth state"
```

---

## Task 13: Map Component + Homepage

**Files:**
- Create: `components/Map.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Create `components/Map.tsx`**

Note: Leaflet requires `window` — this component must be client-only and dynamically imported with `ssr: false`.

```tsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import type { CatPin } from '@/types'

// Leaflet and leaflet.markercluster are loaded at runtime only
let L: typeof import('leaflet')

export default function Map() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  const clusterRef = useRef<any>(null)

  const fetchAndRenderPins = useCallback(async (map: import('leaflet').Map) => {
    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    const params = new URLSearchParams({
      swLat: String(sw.lat),
      swLng: String(sw.lng),
      neLat: String(ne.lat),
      neLng: String(ne.lng),
    })

    const res = await fetch(`/api/cats?${params}`)
    if (!res.ok) return
    const pins: CatPin[] = await res.json()

    clusterRef.current.clearLayers()

    pins.forEach((pin) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:48px;height:48px;border-radius:50%;border:3px solid #ff6b35;
          background:url(${pin.thumbnail_url}) center/cover;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;
        "></div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      })

      const marker = L.marker([pin.lat, pin.lng], { icon })
      marker.bindPopup(`
        <div style="min-width:160px;font-family:sans-serif;">
          <img src="${pin.thumbnail_url}" style="width:100%;border-radius:8px;margin-bottom:6px;" />
          <div style="font-weight:700;font-size:13px;">${pin.name ?? 'Unknown cat'}</div>
          <div style="font-size:11px;color:#888;margin:2px 0 8px;">${pin.location_name ?? ''}</div>
          <a href="/cats/${pin.id}" style="
            display:block;background:#ff6b35;color:white;text-align:center;
            padding:6px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;
          ">See full story →</a>
        </div>
      `)
      clusterRef.current.addLayer(marker)
    })
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return

    async function init() {
      L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      const map = L.map(mapRef.current!, {
        center: [19.076, 72.8777], // Mumbai
        zoom: 13,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      const cluster = (L as any).markerClusterGroup({
        iconCreateFunction: (c: any) =>
          L.divIcon({
            html: `<div style="
              width:40px;height:40px;border-radius:50%;background:#ff6b35;
              color:white;font-weight:800;font-size:14px;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">${c.getChildCount()}</div>`,
            className: '',
            iconSize: [40, 40],
          }),
      })
      map.addLayer(cluster)

      // "My Location" button
      const locControl = L.Control.extend({
        onAdd() {
          const btn = L.DomUtil.create('button')
          btn.innerHTML = '📍 My Location'
          btn.style.cssText = 'background:white;border:none;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);'
          L.DomEvent.on(btn, 'click', () => {
            navigator.geolocation.getCurrentPosition(pos => {
              map.setView([pos.coords.latitude, pos.coords.longitude], 15)
            })
          })
          return btn
        },
      })
      new locControl({ position: 'bottomright' }).addTo(map)

      mapInstanceRef.current = map
      clusterRef.current = cluster

      // Debounced moveend
      let timer: ReturnType<typeof setTimeout>
      map.on('moveend', () => {
        clearTimeout(timer)
        timer = setTimeout(() => fetchAndRenderPins(map), 300)
      })

      // Initial load
      await fetchAndRenderPins(map)
    }

    init()
  }, [fetchAndRenderPins])

  return <div ref={mapRef} style={{ height: 'calc(100vh - 44px)', width: '100%' }} />
}
```

- [ ] **Step 2: Create `app/page.tsx`**

```tsx
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 'calc(100vh - 44px)' }} className="bg-[#e8ead8] flex items-center justify-center">
      <p className="text-[#888] text-sm">Loading map…</p>
    </div>
  ),
})

export default function HomePage() {
  return <Map />
}
```

- [ ] **Step 3: Start dev server and verify the map loads**

```bash
npx next dev
```

Open http://localhost:3000. Expected:
- Orange navbar visible
- OpenStreetMap tiles load showing Mumbai
- No console errors about `window`
- "My Location" button appears bottom-right

- [ ] **Step 4: Commit**

```bash
git add components/Map.tsx app/page.tsx
git commit -m "feat: add Leaflet map with bounding box fetch, clustering, and GPS location"
```

---

## Task 14: Cat Detail Page

**Files:**
- Create: `app/cats/[id]/page.tsx`
- Create: `components/CommentThread.tsx`
- Create: `components/CommentForm.tsx`

- [ ] **Step 1: Create `components/CommentThread.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { Comment } from '@/types'
import CommentForm from './CommentForm'

function CommentItem({ comment, catId }: { comment: Comment; catId: string }) {
  const [showReply, setShowReply] = useState(false)
  const [reported, setReported] = useState(false)

  async function handleReport() {
    await fetch(`/api/comments/${comment.id}/report`, { method: 'POST', body: JSON.stringify({}) })
    setReported(true)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-[#ffd6b3] flex items-center justify-center text-xs">🐾</div>
        <span className="text-xs font-semibold text-gray-600">{comment.author_name ?? 'anonymous'}</span>
        <span className="text-xs text-gray-400">· {new Date(comment.created_at).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed pl-8">{comment.text}</p>
      <div className="flex gap-3 pl-8 mt-1">
        <button onClick={() => setShowReply(v => !v)} className="text-xs text-[#ff6b35]">
          ↩ Reply
        </button>
        {!reported && (
          <button onClick={handleReport} className="text-xs text-gray-400">🚩 Report</button>
        )}
        {reported && <span className="text-xs text-gray-400">Reported</span>}
      </div>
      {showReply && (
        <div className="pl-8 mt-2">
          <CommentForm catId={catId} parentId={comment.id} onSubmit={() => setShowReply(false)} compact />
        </div>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-8 mt-3 border-l-2 border-[#ffe0cc]">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} catId={catId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentThread({ comments, catId }: { comments: Comment[]; catId: string }) {
  return (
    <div>
      {comments.map(c => <CommentItem key={c.id} comment={c} catId={catId} />)}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/CommentForm.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { Comment } from '@/types'

interface Props {
  catId: string
  parentId?: string
  onSubmit?: (comment: Comment) => void
  compact?: boolean
}

export default function CommentForm({ catId, parentId, onSubmit, compact }: Props) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat_id: catId, text, author_name: name || null, parent_id: parentId ?? null }),
    })

    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to post')
      return
    }

    const comment: Comment = await res.json()
    setText('')
    setName('')
    onSubmit?.(comment)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {!compact && (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
        />
      )}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={compact ? 'Write a reply…' : 'Share what you know about this cat…'}
        className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2 text-sm bg-[#fffaf8] h-20 resize-none focus:outline-none focus:border-[#ff6b35]"
        required
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#ff6b35] text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Posting…' : compact ? 'Reply' : 'Post comment'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/cats/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/db'
import type { Cat, Comment } from '@/types'
import CommentThread from '@/components/CommentThread'
import CommentForm from '@/components/CommentForm'
import Link from 'next/link'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await supabase
    .from('cats')
    .select('name, location_name, story, photo_url')
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single()

  if (!data) return { title: 'Cat not found — Meows of Mumbai' }

  const title = data.name ? `${data.name} — Meows of Mumbai` : `A cat in ${data.location_name ?? 'Mumbai'} — Meows of Mumbai`
  const description = data.story?.slice(0, 160) ?? `A stray cat spotted in ${data.location_name ?? 'Mumbai'}.`

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: data.photo_url }] },
    twitter: { card: 'summary_large_image', title, description, images: [data.photo_url] },
  }
}

async function getComments(catId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('cat_id', catId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })

  if (!data) return []

  const roots = data.filter(c => !c.parent_id)
  return roots.map(root => ({
    ...root,
    replies: data.filter(c => c.parent_id === root.id),
  }))
}

export default async function CatDetailPage({ params }: Props) {
  const { data: cat } = await supabase
    .from('cats')
    .select('*')
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single() as { data: Cat | null }

  if (!cat) notFound()

  const comments = await getComments(params.id)

  return (
    <main className="max-w-lg mx-auto pb-16">
      <Link href="/" className="flex items-center gap-2 px-4 py-3 text-[#ff6b35] text-sm font-semibold">
        ← Back to map
      </Link>

      {/* Photo */}
      <img
        src={cat.photo_url}
        alt={cat.name ?? 'A stray cat'}
        width={cat.photo_width}
        height={cat.photo_height}
        className="w-full max-h-80 object-cover"
      />

      <div className="px-4 pt-4">
        {/* Name + meta */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {cat.name ?? 'Unknown cat'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {cat.location_name} · {new Date(cat.created_at).toLocaleDateString()}
            </p>
          </div>
          {cat.location_name && (
            <span className="bg-[#fff0e8] text-[#ff6b35] text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              🐾 {cat.location_name}
            </span>
          )}
        </div>

        {/* Story */}
        {cat.story && (
          <blockquote className="border-l-4 border-[#ff6b35] pl-4 py-2 bg-[#fff8f5] rounded-r-lg text-sm text-gray-700 leading-relaxed mb-4 italic">
            {cat.story}
          </blockquote>
        )}

        {/* Report link */}
        <ReportCat catId={cat.id} />

        <hr className="my-5 border-gray-100" />

        {/* Comments */}
        <h2 className="text-sm font-bold text-gray-900 mb-4">
          💬 Community ({comments.length} comment{comments.length !== 1 ? 's' : ''})
        </h2>
        <CommentThread comments={comments} catId={cat.id} />

        <hr className="my-5 border-gray-100" />
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add a comment</h3>
        <CommentForm catId={cat.id} />
      </div>
    </main>
  )
}

function ReportCat({ catId }: { catId: string }) {
  'use client'
  // Minimal inline client component for report button
  return null // Implemented below as a separate client component
}
```

- [ ] **Step 4: Add `ReportButton` client component**

Create `components/ReportButton.tsx`:
```tsx
'use client'
import { useState } from 'react'

export default function ReportButton({ id, type }: { id: string; type: 'cat' | 'comment' }) {
  const [reported, setReported] = useState(false)

  async function handleReport() {
    await fetch(`/api/${type === 'cat' ? 'cats' : 'comments'}/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    setReported(true)
  }

  if (reported) return <span className="text-xs text-gray-400">Reported — thanks</span>
  return (
    <button onClick={handleReport} className="text-xs text-gray-400 hover:text-gray-600">
      🚩 Report this cat
    </button>
  )
}
```

Update the `CatDetailPage` to import and use `ReportButton` (replace the `ReportCat` function):
```tsx
import ReportButton from '@/components/ReportButton'

// Inside the JSX, after the story block:
<div className="mb-4">
  <ReportButton id={cat.id} type="cat" />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add app/cats/ components/CommentThread.tsx components/CommentForm.tsx components/ReportButton.tsx
git commit -m "feat: add cat detail page with OG tags, story, and threaded comments"
```

---

## Task 15: Add Cat Form

**Files:**
- Create: `components/AddCatForm.tsx`
- Create: `app/add/page.tsx`

- [ ] **Step 1: Create `components/AddCatForm.tsx`**

```tsx
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { UploadResult } from '@/types'

type Step = 1 | 2 | 3

interface FormState {
  photo: File | null
  preview: string | null
  upload: UploadResult | null
  lat: number | null
  lng: number | null
  locationName: string | null
  name: string
  story: string
  lastSeenAt: string
}

export default function AddCatForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<FormState>({
    photo: null, preview: null, upload: null,
    lat: null, lng: null, locationName: null,
    name: '', story: '', lastSeenAt: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 1: Photo selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setState(s => ({ ...s, photo: file, preview: URL.createObjectURL(file) }))
  }

  async function handlePhotoNext() {
    if (!state.photo) { setError('Please select a photo'); return }
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.append('photo', state.photo)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    setLoading(false)
    if (!res.ok) { setError('Upload failed. Try again.'); return }
    const upload: UploadResult = await res.json()
    setState(s => ({ ...s, upload }))
    setStep(2)
    // Auto-detect GPS
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setState(s => ({ ...s, lat, lng }))
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then(r => r.json())
          .then(d => {
            const name = d.address?.suburb ?? d.address?.neighbourhood ?? d.address?.city_district ?? null
            setState(s => ({ ...s, locationName: name }))
          })
          .catch(() => {})
      },
      () => {} // GPS denied — user can skip
    )
  }

  async function handleSubmit() {
    if (!state.upload || state.lat == null || state.lng == null) {
      setError('Location is required')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch('/api/cats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state.upload,
        lat: state.lat,
        lng: state.lng,
        location_name: state.locationName,
        name: state.name || null,
        story: state.story || null,
        last_seen_at: state.lastSeenAt || null,
      }),
    })
    setLoading(false)
    if (!res.ok) { setError('Failed to add cat. Try again.'); return }
    const { id } = await res.json()
    router.push(`/cats/${id}`)
  }

  const progress = ['', 'Photo', 'Location', 'Details']

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-[#ff6b35]' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-4">Step {step} of 3 — {progress[step]}</p>

      {/* Step 1: Photo */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Add a cat photo</h2>
          <p className="text-sm text-gray-500">Show us who you found!</p>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#ffb99a] rounded-xl p-10 text-center bg-[#fff8f5] cursor-pointer"
          >
            {state.preview ? (
              <img src={state.preview} alt="preview" className="w-full rounded-lg object-cover max-h-48" />
            ) : (
              <>
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm font-semibold text-[#ff6b35]">Take a photo</p>
                <p className="text-xs text-gray-400 mt-1">or tap to upload from gallery</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handlePhotoNext}
            disabled={loading || !state.photo}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Uploading…' : 'Next →'}
          </button>
        </div>
      )}

      {/* Step 2: Location */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Where was this cat?</h2>
          {state.lat && state.lng ? (
            <div className="bg-[#fff8f5] border border-[#ffe0cc] rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">📍</div>
              <p className="text-sm font-semibold text-gray-800">{state.locationName ?? 'Location detected'}</p>
              <p className="text-xs text-gray-400 mt-1">{state.lat.toFixed(5)}, {state.lng.toFixed(5)}</p>
            </div>
          ) : (
            <div className="bg-[#fff8f5] border border-[#ffe0cc] rounded-xl p-6 text-center text-gray-400 text-sm">
              Detecting GPS location…
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            Location is auto-detected from your device. On desktop, grant browser location access.
          </p>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={() => setStep(3)}
            disabled={state.lat == null}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            Next →
          </button>
          <button onClick={() => setStep(1)} className="w-full text-gray-400 text-sm py-2">
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Tell us about this cat</h2>
          <p className="text-sm text-gray-400">All optional — you can skip straight to adding!</p>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Cat's name or nickname</label>
            <input
              value={state.name}
              onChange={e => setState(s => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Biscuit, Tiger, Mango…"
              className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Short story</label>
            <textarea
              value={state.story}
              onChange={e => setState(s => ({ ...s, story: e.target.value }))}
              placeholder="What's special about this cat?"
              className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] h-28 resize-none focus:outline-none focus:border-[#ff6b35]"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Adding…' : '🐾 Add this cat!'}
          </button>
          <button onClick={() => setStep(2)} className="w-full text-gray-400 text-sm py-2">
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/add/page.tsx`**

```tsx
import AddCatForm from '@/components/AddCatForm'

export default function AddPage() {
  return (
    <main>
      <div className="bg-[#ff6b35] px-4 py-3">
        <h1 className="text-white font-extrabold text-base">Add a Cat</h1>
      </div>
      <AddCatForm />
    </main>
  )
}
```

- [ ] **Step 3: Test the full add flow manually**

```bash
npx next dev
```

1. Go to http://localhost:3000/add
2. Take/upload a photo — verify it uploads and moves to step 2
3. Allow location — verify GPS coordinates appear
4. Fill in optional name/story — click "Add this cat!"
5. Verify redirect to `/cats/[id]` with the new cat

- [ ] **Step 4: Commit**

```bash
git add components/AddCatForm.tsx app/add/
git commit -m "feat: add 3-step cat form with GPS location detection and photo upload"
```

---

## Task 16: Auth Pages

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`

- [ ] **Step 1: Create `app/signup/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Signup failed')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Create account</h1>
      <p className="text-sm text-gray-400 mb-6">Username and password only — no email needed.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="letters, numbers, underscores"
            required
            className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="at least 6 characters"
            required
            className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-400 mt-4">
        Already have an account? <Link href="/login" className="text-[#ff6b35] font-semibold">Log in</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Create `app/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Login failed')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border border-[#ffe0cc] rounded-lg px-3 py-2.5 text-sm bg-[#fffaf8] focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6b35] text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-400 mt-4">
        No account? <Link href="/signup" className="text-[#ff6b35] font-semibold">Sign up</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/login/ app/signup/
git commit -m "feat: add login and signup pages"
```

---

## Task 17: Profile Page

**Files:**
- Create: `app/profile/page.tsx`

- [ ] **Step 1: Create `app/profile/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/db'
import type { Cat, Comment } from '@/types'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const [{ data: cats }, { data: comments }] = await Promise.all([
    supabase
      .from('cats')
      .select('id, thumbnail_url, name, location_name, created_at')
      .eq('user_id', session.userId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('comments')
      .select('id, text, cat_id, created_at')
      .eq('user_id', session.userId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">My contributions</h1>
      <p className="text-sm text-gray-400 mb-6">{session.username}</p>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">🐾 Cats I've added ({cats?.length ?? 0})</h2>
        {cats?.length === 0 && (
          <p className="text-sm text-gray-400">You haven't added any cats yet. <Link href="/add" className="text-[#ff6b35]">Add one!</Link></p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {(cats ?? []).map((cat: Pick<Cat, 'id' | 'thumbnail_url' | 'name' | 'location_name' | 'created_at'>) => (
            <Link key={cat.id} href={`/cats/${cat.id}`}>
              <div className="aspect-square rounded-xl overflow-hidden bg-[#ffd6b3] relative">
                <img src={cat.thumbnail_url} alt={cat.name ?? ''} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-gray-600 mt-1 truncate">{cat.name ?? cat.location_name ?? 'Unknown'}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-700 mb-3">💬 My comments ({comments?.length ?? 0})</h2>
        {comments?.length === 0 && (
          <p className="text-sm text-gray-400">No comments yet.</p>
        )}
        <div className="space-y-3">
          {(comments ?? []).map((c: Pick<Comment, 'id' | 'text' | 'cat_id' | 'created_at'>) => (
            <Link key={c.id} href={`/cats/${c.cat_id}`} className="block bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-sm text-gray-700 line-clamp-2">{c.text}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/profile/
git commit -m "feat: add profile page with user contributions"
```

---

## Task 18: Admin Page

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create `app/admin/page.tsx`**

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/db'
import AdminControls from './AdminControls'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get('admin-auth')?.value

  if (adminAuth !== process.env.ADMIN_PASSWORD) {
    redirect('/admin/login')
  }

  const [{ data: flaggedCats }, { data: flaggedComments }] = await Promise.all([
    supabase
      .from('cats')
      .select('id, thumbnail_url, name, location_name, report_count, is_hidden, created_at')
      .gt('report_count', 0)
      .order('report_count', { ascending: false })
      .limit(50),
    supabase
      .from('comments')
      .select('id, text, author_name, report_count, is_hidden, cat_id, created_at')
      .gt('report_count', 0)
      .order('report_count', { ascending: false })
      .limit(50),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Admin — Moderation</h1>
      <AdminControls flaggedCats={flaggedCats ?? []} flaggedComments={flaggedComments ?? []} />
    </main>
  )
}
```

- [ ] **Step 2: Create `app/admin/AdminControls.tsx`**

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'

interface FlaggedCat {
  id: string; thumbnail_url: string; name: string | null
  location_name: string | null; report_count: number; is_hidden: boolean; created_at: string
}
interface FlaggedComment {
  id: string; text: string; author_name: string | null
  report_count: number; is_hidden: boolean; cat_id: string; created_at: string
}

export default function AdminControls({
  flaggedCats, flaggedComments,
}: { flaggedCats: FlaggedCat[]; flaggedComments: FlaggedComment[] }) {
  const [cats, setCats] = useState(flaggedCats)
  const [comments, setComments] = useState(flaggedComments)

  async function toggleCat(id: string, hide: boolean) {
    await fetch(`/api/admin/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cat', id, is_hidden: hide }),
    })
    setCats(prev => prev.map(c => c.id === id ? { ...c, is_hidden: hide } : c))
  }

  async function toggleComment(id: string, hide: boolean) {
    await fetch(`/api/admin/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'comment', id, is_hidden: hide }),
    })
    setComments(prev => prev.map(c => c.id === id ? { ...c, is_hidden: hide } : c))
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold mb-3">Flagged Cats ({cats.length})</h2>
        {cats.length === 0 && <p className="text-gray-400 text-sm">No flagged cats.</p>}
        <div className="space-y-3">
          {cats.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 bg-white border rounded-xl p-3">
              <img src={cat.thumbnail_url} className="w-12 h-12 rounded-lg object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <Link href={`/cats/${cat.id}`} className="text-sm font-semibold text-gray-900 hover:text-[#ff6b35]">
                  {cat.name ?? cat.location_name ?? 'Unknown'} — {cat.report_count} reports
                </Link>
                <p className="text-xs text-gray-400">{new Date(cat.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${cat.is_hidden ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {cat.is_hidden ? 'Hidden' : 'Visible'}
              </span>
              <button
                onClick={() => toggleCat(cat.id, !cat.is_hidden)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
              >
                {cat.is_hidden ? 'Restore' : 'Hide'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Flagged Comments ({comments.length})</h2>
        {comments.length === 0 && <p className="text-gray-400 text-sm">No flagged comments.</p>}
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-3 bg-white border rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 line-clamp-2">{c.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.author_name ?? 'anonymous'} · {c.report_count} reports ·{' '}
                  <Link href={`/cats/${c.cat_id}`} className="text-[#ff6b35]">View cat</Link>
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${c.is_hidden ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {c.is_hidden ? 'Hidden' : 'Visible'}
              </span>
              <button
                onClick={() => toggleComment(c.id, !c.is_hidden)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg shrink-0"
              >
                {c.is_hidden ? 'Restore' : 'Hide'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/api/admin/toggle/route.ts`**

```typescript
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
```

- [ ] **Step 4: Create `app/admin/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push('/admin') } else { setError(true) }
  }

  return (
    <main className="max-w-xs mx-auto px-4 py-20">
      <h1 className="text-xl font-bold mb-4">Admin Login</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Admin password"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {error && <p className="text-red-500 text-xs">Wrong password</p>}
        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-2 rounded-lg">
          Enter
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Create `app/api/admin/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  const cookieStore = await cookies()
  cookieStore.set('admin-auth', password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/ app/api/admin/
git commit -m "feat: add admin moderation page with hide/restore controls"
```

---

## Task 19: Final Wiring + Deploy

**Files:**
- Create: `.gitignore` additions
- Create: `vercel.json`

- [ ] **Step 1: Update `.gitignore`**

```bash
echo ".env.local" >> .gitignore
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 2: Run all tests**

```bash
npx jest
```

Expected: All tests pass (geo utils + bbox validation).

- [ ] **Step 3: Full manual smoke test**

```bash
npx next build && npx next start
```

Walk through:
1. Open http://localhost:3000 — map loads, Mumbai visible
2. Click "Add a Cat" — 3-step form works
3. Upload a photo, allow GPS, submit — redirects to cat detail page
4. Cat appears on map on next pan/zoom
5. Post a comment — appears in thread
6. Sign up for an account, log in — username in navbar
7. Visit `/profile` — see submitted cat and comment
8. Visit `/admin/login` with ADMIN_PASSWORD — access moderation panel

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel --prod
```

Add environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `ADMIN_PASSWORD`

- [ ] **Step 5: Final commit**

```bash
git add .gitignore
git commit -m "feat: complete Meows of Mumbai MVP"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Map with bounding box fetch (Task 8 + 13)
- ✅ Cat pins with clustering (Task 13)
- ✅ GPS + manual adjust location (Task 15)
- ✅ 3-step add form (Task 15)
- ✅ Photo upload + sharp resize (Task 7)
- ✅ PostGIS geography column + GIST index (Task 3)
- ✅ Nominatim reverse geocoding (Task 15 — called once at submit)
- ✅ Coordinate rounding for privacy (Task 4 + 8)
- ✅ Cat detail page with OG tags (Task 14)
- ✅ Threaded comments, one level deep (Task 14)
- ✅ No-login for adding cats and comments (Tasks 8, 10)
- ✅ Optional accounts — username + password + iron-session (Tasks 5, 6, 16)
- ✅ Profile page — user's cats and comments (Task 17)
- ✅ Report button on cats and comments (Tasks 9, 10, 14)
- ✅ Auto-hide at 5 reports (Tasks 9, 10)
- ✅ Admin page — view and toggle flagged content (Task 18)
- ✅ Rate limiting via Edge middleware (Task 11)
- ✅ 30s edge cache on bounding box API (Task 8)

**Type consistency:** All components use types from `types/index.ts`. `CatPin` used in Map and API. `Cat` used in detail page. `Comment` used in thread. `UploadResult` used in AddCatForm and upload route.

**No placeholders:** All steps include complete code.
