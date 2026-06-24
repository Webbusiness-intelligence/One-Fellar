-- ============================================================
-- 029_ad_soul_id.sql
--
-- Soul ID: an account-level registry of reusable creative assets — characters,
-- products, locations, props, styles. Each has an @handle so it can be
-- referenced from any Create chat (the model is fed the asset image to keep it
-- consistent across generations). Assets are created three ways: generated from
-- a prompt (multi-view reference sheet), uploaded directly, or saved from a
-- Create-chat result. The reference image lives in the `ad-studio` storage
-- bucket (storage_path); asset_id optionally links the underlying ad_assets row.
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_soul_ids (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handle       TEXT NOT NULL,                 -- @handle, unique per account (lowercased)
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'character'
                 CHECK (kind IN ('character','product','location','prop','style')),
  description  TEXT,                           -- prompt / notes used to make it
  storage_path TEXT NOT NULL,                  -- reference image in the ad-studio bucket
  source       TEXT NOT NULL DEFAULT 'prompt'
                 CHECK (source IN ('prompt','upload','chat')),
  asset_id     UUID,                           -- linked ad_assets id, if any
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One handle per account (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS ad_soul_ids_handle_idx
  ON ad_soul_ids(account_id, lower(handle));
CREATE INDEX IF NOT EXISTS ad_soul_ids_account_idx
  ON ad_soul_ids(account_id, created_at DESC);

ALTER TABLE ad_soul_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_soul_ids_select ON ad_soul_ids FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_soul_ids_insert ON ad_soul_ids FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_soul_ids_update ON ad_soul_ids FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_soul_ids_delete ON ad_soul_ids FOR DELETE USING (is_account_member(account_id, 'agent'));
