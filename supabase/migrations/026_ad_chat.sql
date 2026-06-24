-- ============================================================
-- 026_ad_chat.sql
--
-- Conversational Ad Studio: chat threads + messages.
-- Also relaxes ad_jobs.format — the studio now supports many aspect
-- ratios (validated in app code), not just the original three.
-- ============================================================

ALTER TABLE ad_jobs DROP CONSTRAINT IF EXISTS ad_jobs_format_check;

CREATE TABLE IF NOT EXISTS ad_chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_chats_account_idx ON ad_chats(account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ad_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chat_id     UUID NOT NULL REFERENCES ad_chats(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  text        TEXT,
  attachments JSONB NOT NULL DEFAULT '[]',
  asset_ids   JSONB NOT NULL DEFAULT '[]',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_chat_messages_chat_idx ON ad_chat_messages(chat_id, created_at);

ALTER TABLE ad_chats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_chats_select ON ad_chats FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_chats_insert ON ad_chats FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_chats_update ON ad_chats FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_chats_delete ON ad_chats FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE POLICY ad_chat_messages_select ON ad_chat_messages FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ad_chat_messages_insert ON ad_chat_messages FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ad_chat_messages_update ON ad_chat_messages FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ad_chat_messages_delete ON ad_chat_messages FOR DELETE USING (is_account_member(account_id, 'agent'));
