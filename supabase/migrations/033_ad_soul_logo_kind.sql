-- ============================================================
-- 033_ad_soul_logo_kind.sql
--
-- Add a "logo" kind to Soul IDs — for brand logos / flat graphics. The generate
-- template renders the graphic faithfully on a clean background (never a person),
-- so a logo prompt no longer gets forced into a character. Re-runnable.
-- ============================================================

ALTER TABLE ad_soul_ids DROP CONSTRAINT IF EXISTS ad_soul_ids_kind_check;
ALTER TABLE ad_soul_ids
  ADD CONSTRAINT ad_soul_ids_kind_check
  CHECK (kind IN ('character', 'product', 'location', 'prop', 'style', 'logo'));
