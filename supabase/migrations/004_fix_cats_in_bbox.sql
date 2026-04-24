-- Migration 004: Fix cats_in_bbox
-- Two bugs:
--   1. is_approved = TRUE filtered out all unapproved cats (default is FALSE, approval workflow doesn't exist yet)
--   2. created_at was missing from the RETURNS TABLE so popup's "Recent" date was always undefined

DROP FUNCTION IF EXISTS cats_in_bbox(FLOAT8, FLOAT8, FLOAT8, FLOAT8, TEXT);

CREATE FUNCTION cats_in_bbox(
  sw_lat   FLOAT8,
  sw_lng   FLOAT8,
  ne_lat   FLOAT8,
  ne_lng   FLOAT8,
  sort_by  TEXT DEFAULT 'recent'
)
RETURNS TABLE (
  id UUID, thumbnail_url TEXT, lat FLOAT8, lng FLOAT8,
  name TEXT, location_name TEXT, upvote_count INT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF sort_by = 'loved' THEN
    RETURN QUERY
      SELECT c.id, c.thumbnail_url, c.lat, c.lng, c.name, c.location_name, c.upvote_count, c.created_at
      FROM cats c
      WHERE c.location && ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
        AND c.is_hidden = FALSE
      ORDER BY c.upvote_count DESC, c.created_at DESC
      LIMIT 200;
  ELSE
    RETURN QUERY
      SELECT c.id, c.thumbnail_url, c.lat, c.lng, c.name, c.location_name, c.upvote_count, c.created_at
      FROM cats c
      WHERE c.location && ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
        AND c.is_hidden = FALSE
      ORDER BY c.created_at DESC
      LIMIT 200;
  END IF;
END;
$$;
