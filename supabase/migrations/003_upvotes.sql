-- ── Migration 003: Upvotes ────────────────────────────────────────────────────

-- 1. Add upvote_count to cats
ALTER TABLE cats ADD COLUMN IF NOT EXISTS upvote_count INT NOT NULL DEFAULT 0;

-- 2. Upvotes table: one vote per IP per cat
CREATE TABLE IF NOT EXISTS cat_upvotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id     UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  ip         TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cat_id, ip)
);

CREATE INDEX IF NOT EXISTS cat_upvotes_cat_id_idx ON cat_upvotes(cat_id);

-- 3. Trigger: keep upvote_count in sync automatically
CREATE OR REPLACE FUNCTION sync_upvote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cats SET upvote_count = upvote_count + 1 WHERE id = NEW.cat_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cats SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.cat_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upvote_count ON cat_upvotes;
CREATE TRIGGER trg_upvote_count
AFTER INSERT OR DELETE ON cat_upvotes
FOR EACH ROW EXECUTE FUNCTION sync_upvote_count();

-- 4. Replace cats_in_bbox — adds upvote_count to return set + optional sort_by param
--    Must DROP first because the return type changes (adding upvote_count column)
DROP FUNCTION IF EXISTS cats_in_bbox(FLOAT8, FLOAT8, FLOAT8, FLOAT8);

CREATE FUNCTION cats_in_bbox(
  sw_lat   FLOAT8,
  sw_lng   FLOAT8,
  ne_lat   FLOAT8,
  ne_lng   FLOAT8,
  sort_by  TEXT DEFAULT 'recent'
)
RETURNS TABLE (
  id UUID, thumbnail_url TEXT, lat FLOAT8, lng FLOAT8,
  name TEXT, location_name TEXT, upvote_count INT
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF sort_by = 'loved' THEN
    RETURN QUERY
      SELECT c.id, c.thumbnail_url, c.lat, c.lng, c.name, c.location_name, c.upvote_count
      FROM cats c
      WHERE c.location && ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
        AND c.is_hidden = FALSE AND c.is_approved = TRUE
      ORDER BY c.upvote_count DESC, c.created_at DESC
      LIMIT 200;
  ELSE
    RETURN QUERY
      SELECT c.id, c.thumbnail_url, c.lat, c.lng, c.name, c.location_name, c.upvote_count
      FROM cats c
      WHERE c.location && ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
        AND c.is_hidden = FALSE AND c.is_approved = TRUE
      ORDER BY c.created_at DESC
      LIMIT 200;
  END IF;
END;
$$;
