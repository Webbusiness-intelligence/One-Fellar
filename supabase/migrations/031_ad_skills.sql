-- ============================================================
-- 031_ad_skills.sql
--
-- Skills: installable, selectable prompt RECIPES that shape generation — the
-- "look / workflow" — distinct from Soul IDs (which lock the *subject*). A skill's
-- recipe is folded into the director's instruction at generation time, so the
-- output follows the skill. Built-in skills live in code
-- (src/lib/ai-ads/skills.ts); this table holds an account's CUSTOM skills, created
-- in the studio or saved from a result you liked.
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug         TEXT NOT NULL,                       -- stable handle, unique per account
  name         TEXT NOT NULL,
  icon         TEXT,                                -- emoji or lucide icon name
  kind         TEXT NOT NULL DEFAULT 'both'
                 CHECK (kind IN ('image','video','both')),
  recipe       TEXT NOT NULL,                       -- style/director guidance, folded into the prompt
  negative     TEXT,                                -- things to avoid (negative-prompt add-on)
  defaults     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {mood, aspect, quality, realism, engine}
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One slug per account (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS ad_skills_slug_idx ON ad_skills(account_id, lower(slug));
CREATE INDEX IF NOT EXISTS ad_skills_account_idx ON ad_skills(account_id, created_at DESC);

ALTER TABLE ad_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_skills_select ON ad_skills;
DROP POLICY IF EXISTS ad_skills_insert ON ad_skills;
DROP POLICY IF EXISTS ad_skills_update ON ad_skills;
DROP POLICY IF EXISTS ad_skills_delete ON ad_skills;
CREATE POLICY ad_skills_select ON ad_skills FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_skills_insert ON ad_skills FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_skills_update ON ad_skills FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_skills_delete ON ad_skills FOR DELETE USING (is_account_member(account_id, 'agent'));
