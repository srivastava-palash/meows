-- Migration 002: add cat_photos table for multiple photos per cat
CREATE TABLE cat_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  photo_width INT NOT NULL DEFAULT 0,
  photo_height INT NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cat_photos_cat_id_idx ON cat_photos(cat_id, display_order);
