-- ============================================================
-- 024_ad_studio.sql
--
-- Ad Studio — AI product-ad generator module.
-- Four account-scoped tables + a private storage bucket. RLS mirrors
-- the existing account model (is_account_member / account_role_enum,
-- see 017_account_sharing.sql). All access from the app is server-side
-- (service role) or read via signed URLs, so the bucket stays private.
-- ============================================================

-- ---- TABLES ----

CREATE TABLE IF NOT EXISTS ad_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  description TEXT,
  brand_colors JSONB,
  source_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_products_account_idx ON ad_products(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_product_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES ad_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  cutout_path  TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_product_images_product_idx ON ad_product_images(product_id);

CREATE TABLE IF NOT EXISTS ad_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id     UUID REFERENCES ad_products(id) ON DELETE SET NULL,
  type           TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image','video','ugc')),
  prompt         TEXT,
  brief          JSONB,
  format         TEXT NOT NULL DEFAULT '1:1' CHECK (format IN ('1:1','9:16','16:9')),
  status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  model          TEXT,
  error          TEXT,
  fal_request_id TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_jobs_account_idx ON ad_jobs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_jobs_product_idx ON ad_jobs(product_id);

CREATE TABLE IF NOT EXISTS ad_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES ad_jobs(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image','video')),
  storage_path    TEXT NOT NULL,
  variation_index INT NOT NULL DEFAULT 0,
  score           NUMERIC,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_assets_job_idx ON ad_assets(job_id);
CREATE INDEX IF NOT EXISTS ad_assets_account_idx ON ad_assets(account_id, created_at DESC);

-- ---- RLS (account-scoped, mirrors 017_account_sharing.sql) ----

ALTER TABLE ad_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_assets         ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_products_select ON ad_products FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_products_insert ON ad_products FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_products_update ON ad_products FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_products_delete ON ad_products FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE POLICY ad_product_images_select ON ad_product_images FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_product_images_insert ON ad_product_images FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_product_images_update ON ad_product_images FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_product_images_delete ON ad_product_images FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE POLICY ad_jobs_select ON ad_jobs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_jobs_insert ON ad_jobs FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_jobs_update ON ad_jobs FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_jobs_delete ON ad_jobs FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE POLICY ad_assets_select ON ad_assets FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_assets_insert ON ad_assets FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_assets_update ON ad_assets FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_assets_delete ON ad_assets FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- STORAGE: private bucket for product inputs + generated outputs ----

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-studio',
  'ad-studio',
  false,
  52428800, -- 50 MB
  ARRAY['image/png','image/jpeg','image/webp','video/mp4','video/webm']
)
ON CONFLICT (id) DO NOTHING;
