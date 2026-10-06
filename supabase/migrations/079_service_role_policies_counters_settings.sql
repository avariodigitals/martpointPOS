-- Fix Supabase security linter `rls_enabled_no_policy` (lint 0008) and correct a
-- document-number prefix regression introduced by migration 078.
--
-- PART A — prefix regression (IMPORTANT)
--   Committed migration 078 rewrote public.next_commission_payout_reference() with a
--   typo: it returns 'MPC-' instead of the original 'MPCP-'. Because 078 was applied,
--   the LIVE function is currently producing references like "MPC-2026-00001".
--   The intended prefix is confirmed by lib/finance-commercial.ts:
--       if (!isSupabaseConfigured()) return "MPCP-00000-00000"
--   'MPC-' is also used by unrelated generators (career application refs,
--   creator IDs), so the current output is ambiguous as well as wrong.
--   This restores 'MPCP-' and keeps the hardened `SET search_path = ''`.
--
-- PART B — lint 0008
--   `public.receipt_number_counters` and `public.settings` have RLS enabled but no
--   policies, so the linter cannot tell whether access was intended. Both tables are
--   reached by the application only through the server (the service-role client in
--   lib/supabase.ts), e.g.:
--     * next_receipt_number()  -> receipt_number_counters  (lib/finance-commercial.ts)
--     * /api/settings, /api/admin/settings -> settings
--   We add the standard `service_role` ALL policy used by every other table.
--
-- This supersedes the (unapplied) section 3 of migration 078, which never reached the
-- database. Migration 077/078 remain as history; this file is the clean, complete fix.
--
-- Idempotent: safe to re-run.

-- ─────────────────────────── PART A: restore MPCP- prefix ───────────────────────
CREATE OR REPLACE FUNCTION public.next_commission_payout_reference(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.commission_payout_reference_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.commission_payout_reference_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPCP-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ─────────────────────────── PART B: RLS policies ───────────────────────────────

-- Receipt number counters
ALTER TABLE public.receipt_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_receipt_number_counters_all" ON public.receipt_number_counters;
CREATE POLICY "sr_receipt_number_counters_all" ON public.receipt_number_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Site settings
-- Drop any legacy/out-of-band policy names that may exist on the live DB so this
-- migration converges to a single, explicit service-role policy.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to settings" ON public.settings;
DROP POLICY IF EXISTS "Allow anon read" ON public.settings;
DROP POLICY IF EXISTS "Allow service role write" ON public.settings;
DROP POLICY IF EXISTS "sr_settings_all" ON public.settings;
CREATE POLICY "sr_settings_all" ON public.settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
