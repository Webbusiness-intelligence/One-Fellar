-- ============================================================
-- 038_autopilot_refs.sql — richer autopilot rules.
-- Reference images + Soul IDs the rule always uses, output format, and an
-- auto-caption toggle. Re-runnable. Apply manually in the Supabase SQL editor.
-- ============================================================

ALTER TABLE autopilot_rules ADD COLUMN IF NOT EXISTS ref_urls     TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE autopilot_rules ADD COLUMN IF NOT EXISTS soul_ids     UUID[]  NOT NULL DEFAULT '{}';
ALTER TABLE autopilot_rules ADD COLUMN IF NOT EXISTS format       TEXT    NOT NULL DEFAULT '1:1';
ALTER TABLE autopilot_rules ADD COLUMN IF NOT EXISTS auto_caption BOOLEAN NOT NULL DEFAULT false;
