-- ============================================================
-- 034_ad_jobs_soul_type.sql
--
-- Allow 'soul' as an ad_jobs.type. The Soul ID generator enqueues type='soul'
-- jobs (worker/run-soul), but the original ad_jobs CHECK (migration 024) only
-- permitted 'image' / 'video' — so Soul generation failed at enqueue with:
--   new row for relation "ad_jobs" violates check constraint "ad_jobs_type_check"
-- (surfaced to the user as a generic 500 / "internal server error").
-- Re-runnable.
-- ============================================================

ALTER TABLE ad_jobs DROP CONSTRAINT IF EXISTS ad_jobs_type_check;
ALTER TABLE ad_jobs
  ADD CONSTRAINT ad_jobs_type_check
  CHECK (type IN ('image', 'video', 'soul'));
