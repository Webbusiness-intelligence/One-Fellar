-- 025_ad_asset_favorite.sql
-- Favorite / save flag on generated ads (for the action bar + Favorites filter).

ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS ad_assets_favorite_idx
  ON ad_assets(account_id, created_at DESC)
  WHERE favorite;
