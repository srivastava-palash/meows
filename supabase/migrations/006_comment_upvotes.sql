-- Migration 006: Comment upvotes + sort
-- Adds upvote_count to comments, a comment_upvotes join table, and a trigger to keep the count in sync.

-- 1. upvote_count on comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS upvote_count INT NOT NULL DEFAULT 0;

-- 2. Upvotes table (one vote per voter_id per comment)
CREATE TABLE IF NOT EXISTS comment_upvotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, voter_id)
);

CREATE INDEX IF NOT EXISTS comment_upvotes_comment_id_idx ON comment_upvotes(comment_id);

-- 3. Trigger: keep upvote_count in sync
CREATE OR REPLACE FUNCTION sync_comment_upvote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET upvote_count = upvote_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comment_upvote_count ON comment_upvotes;
CREATE TRIGGER trg_comment_upvote_count
AFTER INSERT OR DELETE ON comment_upvotes
FOR EACH ROW EXECUTE FUNCTION sync_comment_upvote_count();
