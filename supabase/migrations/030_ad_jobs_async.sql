-- 030_ad_jobs_async.sql
-- Async job queue foundation for Ad Studio generation (see design sketch).
-- Turns ad_jobs into a real Postgres-backed work queue + adds a credits ledger.
-- ADDITIVE + idempotent: the current synchronous routes keep working until the
-- enqueue route + worker start using these. The job PAYLOAD reuses the existing
-- ad_jobs.brief (JSONB) column — no separate `input` column needed.
--
-- All functions are meant to be called server-side with the SERVICE ROLE
-- (supabaseAdmin), which bypasses RLS — the app does auth (requireRole) first.

-- ---------------------------------------------------------------------------
-- 1) Queue mechanics on ad_jobs
-- ---------------------------------------------------------------------------
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS progress          TEXT;
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS attempts          INT NOT NULL DEFAULT 0;
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS locked_at         TIMESTAMPTZ;
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS locked_by         TEXT;
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS priority          INT NOT NULL DEFAULT 0;
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS estimated_credits INT;
ALTER TABLE ad_jobs ADD COLUMN IF NOT EXISTS actual_credits    INT;

-- Allow 'canceled' alongside the existing statuses.
ALTER TABLE ad_jobs DROP CONSTRAINT IF EXISTS ad_jobs_status_check;
ALTER TABLE ad_jobs ADD CONSTRAINT ad_jobs_status_check
  CHECK (status IN ('queued','processing','completed','failed','canceled'));

-- Fast lookup of the next claimable job.
CREATE INDEX IF NOT EXISTS ad_jobs_queue_idx
  ON ad_jobs (priority DESC, created_at)
  WHERE status = 'queued';

-- ---------------------------------------------------------------------------
-- 2) Atomic claim — the concurrency story. SKIP LOCKED means N workers never
--    grab the same job; the correlated count enforces a per-account cap so one
--    account can't hog every slot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_ad_job(worker TEXT, max_per_account INT DEFAULT 2)
RETURNS SETOF ad_jobs
LANGUAGE sql
AS $$
  UPDATE ad_jobs
     SET status     = 'processing',
         locked_at  = now(),
         locked_by  = worker,
         attempts   = attempts + 1,
         updated_at = now()
   WHERE id = (
     SELECT j.id
       FROM ad_jobs j
      WHERE j.status = 'queued'
        AND (
          SELECT count(*) FROM ad_jobs p
           WHERE p.account_id = j.account_id AND p.status = 'processing'
        ) < max_per_account
      ORDER BY j.priority DESC, j.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
  RETURNING *;
$$;

-- Requeue jobs whose worker died mid-flight (reaper). Run on an interval.
CREATE OR REPLACE FUNCTION requeue_stale_ad_jobs(stale_minutes INT DEFAULT 15)
RETURNS INT
LANGUAGE sql
AS $$
  WITH revived AS (
    UPDATE ad_jobs
       SET status = 'queued', locked_at = NULL, locked_by = NULL, updated_at = now()
     WHERE status = 'processing'
       AND locked_at < now() - make_interval(mins => stale_minutes)
       AND attempts < 3
    RETURNING 1
  )
  SELECT count(*)::INT FROM revived;
$$;

-- ---------------------------------------------------------------------------
-- 3) Credits — balance on the account + an audit ledger (1 credit = $0.01).
-- ---------------------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_balance INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_ledger (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  job_id     UUID REFERENCES ad_jobs(id) ON DELETE SET NULL,
  delta      INT NOT NULL,                -- -reserve, +settle/refund, +purchase/grant
  reason     TEXT NOT NULL CHECK (reason IN ('reserve','settle','refund','purchase','grant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_account_idx ON credit_ledger(account_id, created_at DESC);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_ledger_select ON credit_ledger;
CREATE POLICY credit_ledger_select ON credit_ledger
  FOR SELECT USING (is_account_member(account_id));

-- Reserve credits + enqueue, atomically. Raises 'insufficient_credits' if short
-- (the enqueue route maps that to HTTP 402).
CREATE OR REPLACE FUNCTION reserve_and_enqueue(
  acct UUID, creator UUID, est INT, payload JSONB, jtype TEXT, fmt TEXT DEFAULT '1:1'
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE jid UUID;
BEGIN
  UPDATE accounts SET credit_balance = credit_balance - est
   WHERE id = acct AND credit_balance >= est;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO ad_jobs(account_id, created_by, type, status, brief, format, estimated_credits)
  VALUES (acct, creator, jtype, 'queued', payload, fmt, est)
  RETURNING id INTO jid;

  INSERT INTO credit_ledger(account_id, job_id, delta, reason)
  VALUES (acct, jid, -est, 'reserve');

  RETURN jid;
END; $$;

-- Settle a completed job: true-up the reserve to actual cost (refund the diff).
CREATE OR REPLACE FUNCTION settle_ad_job(jid UUID, actual INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE acct UUID; est INT;
BEGIN
  SELECT account_id, estimated_credits INTO acct, est FROM ad_jobs WHERE id = jid;
  IF acct IS NULL THEN RETURN; END IF;
  UPDATE accounts SET credit_balance = credit_balance + (COALESCE(est,0) - actual) WHERE id = acct;
  INSERT INTO credit_ledger(account_id, job_id, delta, reason)
  VALUES (acct, jid, COALESCE(est,0) - actual, 'settle');
  UPDATE ad_jobs
     SET status='completed', actual_credits=actual, progress='done', error=NULL, updated_at=now()
   WHERE id = jid;
END; $$;

-- Fail a job: refund the full reserve (users never pay for failures). Guarded so
-- it can't double-refund.
CREATE OR REPLACE FUNCTION refund_ad_job(jid UUID, err TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE acct UUID; est INT; already INT;
BEGIN
  SELECT account_id, estimated_credits, actual_credits INTO acct, est, already
    FROM ad_jobs WHERE id = jid;
  IF acct IS NULL THEN RETURN; END IF;
  IF already IS NULL AND COALESCE(est,0) > 0 THEN
    UPDATE accounts SET credit_balance = credit_balance + est WHERE id = acct;
    INSERT INTO credit_ledger(account_id, job_id, delta, reason)
    VALUES (acct, jid, est, 'refund');
  END IF;
  UPDATE ad_jobs SET status='failed', actual_credits=0, error=err, updated_at=now() WHERE id = jid;
END; $$;

-- ---------------------------------------------------------------------------
-- 4) Realtime — stream ad_jobs row updates to the client (status/progress).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ad_jobs;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already published
  WHEN undefined_object THEN NULL;   -- publication missing (non-Supabase env)
END $$;

-- ---------------------------------------------------------------------------
-- 5) (OPTIONAL) starter credits so testing isn't blocked once routes go async.
--    Uncomment to grant every existing account 1000 credits ($10).
-- UPDATE accounts SET credit_balance = 1000 WHERE credit_balance = 0;
-- ---------------------------------------------------------------------------
