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

-- Bounding box query function used by /api/cats
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
