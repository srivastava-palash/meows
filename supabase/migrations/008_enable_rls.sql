-- ── Migration 008: Enable Row-Level Security ──────────────────────────────────
--
-- All writes go through Next.js API routes that use the SERVICE ROLE KEY, which
-- bypasses RLS entirely.  These policies only restrict what the public ANON KEY
-- (exposed in NEXT_PUBLIC_SUPABASE_ANON_KEY) can do via the REST API directly.
--
-- Rule of thumb applied here:
--   • Public data  → anon can SELECT, nothing else.
--   • Sensitive data → anon gets nothing (service role only).

-- ── cats ──────────────────────────────────────────────────────────────────────
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;

-- Anyone can browse approved, visible cats (used by the map).
CREATE POLICY "cats_anon_read"
  ON cats FOR SELECT
  USING (is_hidden = FALSE AND is_approved = TRUE);

-- ── comments ─────────────────────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible comments.
CREATE POLICY "comments_anon_read"
  ON comments FOR SELECT
  USING (is_hidden = FALSE);

-- ── cat_photos ────────────────────────────────────────────────────────────────
ALTER TABLE cat_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can read cat photos (public gallery).
CREATE POLICY "cat_photos_anon_read"
  ON cat_photos FOR SELECT
  USING (true);

-- ── cat_upvotes ───────────────────────────────────────────────────────────────
ALTER TABLE cat_upvotes ENABLE ROW LEVEL SECURITY;

-- No anon access — votes are recorded server-side via service role only.
-- (No policy = anon key cannot touch this table at all.)

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- No anon access — password hashes must never be exposed to the anon key.
-- (No policy = anon key cannot touch this table at all.)

-- ── reports ───────────────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
