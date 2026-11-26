-- Scheduled full-balance transfers between payment accounts.
CREATE TABLE IF NOT EXISTS public.finance_account_sweeps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  interval_days INTEGER NOT NULL CHECK (interval_days BETWEEN 1 AND 365),
  active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL,
  claim_token UUID,
  claim_expires_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('COMPLETED', 'SKIPPED', 'FAILED')),
  last_amount NUMERIC(14,2),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_account_id <> destination_account_id)
);

CREATE INDEX IF NOT EXISTS finance_account_sweeps_due_idx
  ON public.finance_account_sweeps (next_run_at)
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS finance_account_sweeps_one_active_per_source_idx
  ON public.finance_account_sweeps (source_account_id)
  WHERE active = true;

-- Scheduled transfers use the sweep-run UUID as source_id; prevent duplicate
-- posted journal entries if a worker retries after an uncertain response.
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_unique_transfer_source_idx
  ON public.journal_entries (source_id)
  WHERE source_type = 'TRANSFER' AND source_id IS NOT NULL;

ALTER TABLE public.finance_account_sweeps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_finance_account_sweeps_all" ON public.finance_account_sweeps;
CREATE POLICY "sr_finance_account_sweeps_all" ON public.finance_account_sweeps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.finance_account_sweep_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sweep_id UUID NOT NULL REFERENCES public.finance_account_sweeps(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'SKIPPED', 'FAILED')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (sweep_id, scheduled_for)
);

ALTER TABLE public.finance_account_sweep_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_finance_account_sweep_runs_all" ON public.finance_account_sweep_runs;
CREATE POLICY "sr_finance_account_sweep_runs_all" ON public.finance_account_sweep_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_due_finance_account_sweeps(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  sweep_id UUID,
  source_account_id UUID,
  destination_account_id UUID,
  interval_days INTEGER,
  next_run_at TIMESTAMPTZ,
  claim_token UUID
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT s.id
    FROM public.finance_account_sweeps s
    WHERE s.active = true
      AND s.next_run_at <= now()
      AND (s.claim_expires_at IS NULL OR s.claim_expires_at <= now())
    ORDER BY s.next_run_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.finance_account_sweeps s
    SET claim_token = gen_random_uuid(),
        claim_expires_at = now() + interval '10 minutes',
        updated_at = now()
    FROM due
    WHERE s.id = due.id
    RETURNING s.id, s.source_account_id, s.destination_account_id,
              s.interval_days, s.next_run_at, s.claim_token
  )
  SELECT c.id, c.source_account_id, c.destination_account_id,
         c.interval_days, c.next_run_at, c.claim_token
  FROM claimed c;
$$;

REVOKE ALL ON FUNCTION public.claim_due_finance_account_sweeps(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_finance_account_sweeps(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.finance_payment_account_balance(p_payment_account_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::NUMERIC(14,2)
  FROM public.payment_accounts pa
  JOIN public.journal_lines jl ON jl.gl_account_id = pa.gl_account_id
  JOIN public.journal_entries je ON je.id = jl.journal_entry_id
  WHERE pa.id = p_payment_account_id
    AND je.status = 'POSTED';
$$;

REVOKE ALL ON FUNCTION public.finance_payment_account_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_payment_account_balance(UUID) TO service_role;
