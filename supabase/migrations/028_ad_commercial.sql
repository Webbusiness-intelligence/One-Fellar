-- ============================================================
-- 028_ad_commercial.sql
--
-- Commercial mode: multi-scene stitched ad projects (Higgsfield-style).
-- A commercial = a production bible + an ordered list of scenes. Each scene
-- is generated independently (with variations), the keeper is LOCKED, and only
-- locked scenes are stitched into the final film. Keyframe/variation/final video
-- assets are stored in ad_assets (referenced by id here).
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_commercials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title             TEXT,
  brief             TEXT,
  preset            TEXT,                       -- ad type: tv_spot, ugc, hyper_motion, unboxing, etc.
  format            TEXT NOT NULL DEFAULT '9:16',
  duration_target   INT  NOT NULL DEFAULT 30,   -- seconds (15-60)
  asset_ids         JSONB NOT NULL DEFAULT '[]',-- product / character / location / prop @tag assets (ad_assets ids)
  bible             JSONB NOT NULL DEFAULT '{}', -- product/character/location/palette spec
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','scripted','rendering','completed','failed')),
  final_asset_id    UUID,                        -- the stitched film (ad_assets id)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_commercials_account_idx ON ad_commercials(account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ad_commercial_scenes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  commercial_id       UUID NOT NULL REFERENCES ad_commercials(id) ON DELETE CASCADE,
  idx                 INT  NOT NULL DEFAULT 0,     -- order within the commercial
  summary             TEXT,
  keyframe_prompt     TEXT,                        -- gpt-image prompt for this scene's start frame
  prompt              TEXT,                        -- structured Kling motion prompt (editable)
  duration            INT  NOT NULL DEFAULT 5,     -- seconds (3/5/10)
  keyframe_asset_id   UUID,                        -- chosen start-frame image (ad_assets id)
  variation_asset_ids JSONB NOT NULL DEFAULT '[]', -- all rendered video variations (ad_assets ids)
  locked_asset_id     UUID,                        -- the locked keeper (ad_assets id)
  locked              BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'pending',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_commercial_scenes_commercial_idx
  ON ad_commercial_scenes(commercial_id, idx);

ALTER TABLE ad_commercials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_commercial_scenes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_commercials_select ON ad_commercials FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_commercials_insert ON ad_commercials FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_commercials_update ON ad_commercials FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_commercials_delete ON ad_commercials FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE POLICY ad_commercial_scenes_select ON ad_commercial_scenes FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_commercial_scenes_insert ON ad_commercial_scenes FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_commercial_scenes_update ON ad_commercial_scenes FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_commercial_scenes_delete ON ad_commercial_scenes FOR DELETE USING (is_account_member(account_id, 'agent'));
