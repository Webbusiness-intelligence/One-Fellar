-- ============================================================
-- 039_autopilot_mood.sql — mood/style control on autopilot rules.
-- Re-runnable. Apply manually in the Supabase SQL editor.
-- ============================================================

ALTER TABLE autopilot_rules ADD COLUMN IF NOT EXISTS mood TEXT NOT NULL DEFAULT 'auto';
