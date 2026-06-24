-- ============================================================
-- 027_ad_brand_kit.sql
--
-- Brand kit: one per account — colours, fonts, voice notes, logo.
-- Injected into chat-studio generations so output stays on-brand.
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_brand_kits (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  brand_name TEXT,
  colors     JSONB NOT NULL DEFAULT '[]',
  fonts      TEXT,
  notes      TEXT,
  logo_path  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ad_brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_brand_kits_select ON ad_brand_kits FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_brand_kits_insert ON ad_brand_kits FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_brand_kits_update ON ad_brand_kits FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_brand_kits_delete ON ad_brand_kits FOR DELETE USING (is_account_member(account_id, 'agent'));
