-- ============================================================
-- 035_billing.sql — Paystack billing.
--
-- Adds plan + Paystack identifiers to accounts, and a billing_events ledger so
-- webhook events are processed exactly once (reference is UNIQUE). Re-runnable.
-- Apply manually in the Supabase SQL editor.
-- ============================================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS accounts_paystack_customer_idx ON accounts(paystack_customer_code);

-- Idempotent ledger of Paystack webhook events. The UNIQUE reference means a retried
-- webhook (Paystack retries) can't double-grant credits.
CREATE TABLE IF NOT EXISTS billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  reference       TEXT UNIQUE NOT NULL,
  event           TEXT NOT NULL,
  amount          INT,          -- subunits (cents)
  currency        TEXT,
  credits_granted INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
-- No public policies: only the service-role (webhook admin client) touches this table.
