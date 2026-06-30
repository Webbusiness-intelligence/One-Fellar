-- ============================================================
-- 036_scheduled_posts.sql — social scheduling (Phase 1).
-- Tracks posts we send to Ayrshare + their status. Re-runnable.
-- Apply manually in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  caption       TEXT NOT NULL DEFAULT '',
  media_urls    TEXT[] NOT NULL DEFAULT '{}',
  platforms     TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at  TIMESTAMPTZ,                 -- null = posted immediately
  status        TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','posted','failed')),
  ayrshare_id   TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_posts_account_idx ON scheduled_posts(account_id, created_at DESC);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_posts_select ON scheduled_posts;
CREATE POLICY scheduled_posts_select ON scheduled_posts
  FOR SELECT USING (is_account_member(account_id));
-- Writes go through the service-role (API routes), so no insert/update policy needed.
