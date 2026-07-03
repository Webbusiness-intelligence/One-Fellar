-- ============================================================
-- 041_ad_jobs_autopilot_type.sql
--
-- Allow 'autopilot' as an ad_jobs.type. Autopilot rules previously generated
-- and posted images WITHOUT charging any credits (they bypassed the job queue
-- entirely). The worker now reserves credits per post via reserve_and_enqueue
-- with jtype='autopilot' — this extends the type CHECK so that insert succeeds.
-- Until this is applied, the worker logs "billing unavailable … running rule
-- UNBILLED" and keeps posting (no interruption, just uncharged).
-- Re-runnable.
-- ============================================================

ALTER TABLE ad_jobs DROP CONSTRAINT IF EXISTS ad_jobs_type_check;
ALTER TABLE ad_jobs
  ADD CONSTRAINT ad_jobs_type_check
  CHECK (type IN ('image', 'video', 'ugc', 'soul', 'autopilot'));
