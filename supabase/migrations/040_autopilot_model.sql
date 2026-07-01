-- ============================================================
-- 040_autopilot_model.sql — image model choice on autopilot rules.
-- 'auto' = the worker picks (GPT Image 2 for refs/Souls, else 1.5).
-- Re-runnable. Apply manually in the Supabase SQL editor.
-- ============================================================

ALTER TABLE autopilot_rules ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'auto';
