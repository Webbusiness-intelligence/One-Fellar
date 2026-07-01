-- ============================================================
-- 037_autopilot.sql — recurring auto-generate + auto-post rules.
-- The worker ticks every 60s, fires due rules (generate → post), reschedules.
-- Re-runnable. Apply manually in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS autopilot_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name           TEXT NOT NULL DEFAULT 'Autopilot',
  prompt         TEXT NOT NULL,                 -- what to generate each run
  caption        TEXT NOT NULL DEFAULT '',
  platforms      TEXT[] NOT NULL DEFAULT '{}',
  interval_hours INT NOT NULL DEFAULT 168,       -- 24=daily, 168=weekly
  next_run_at    TIMESTAMPTZ NOT NULL,
  last_run_at    TIMESTAMPTZ,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS autopilot_due_idx ON autopilot_rules(active, next_run_at);

ALTER TABLE autopilot_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS autopilot_select ON autopilot_rules;
CREATE POLICY autopilot_select ON autopilot_rules FOR SELECT USING (is_account_member(account_id));

-- link each auto-generated post back to its rule
ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS autopilot_rule_id UUID REFERENCES autopilot_rules(id) ON DELETE SET NULL;
