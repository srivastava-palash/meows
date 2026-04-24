-- Add optional email column to users (unique, used for password reset only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
