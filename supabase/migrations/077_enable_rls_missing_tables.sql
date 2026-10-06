-- Fix Supabase security linter `rls_disabled_in_public` (lint 0013).
--
-- Eight public tables were created without row level security, so they were
-- reachable through PostgREST by the `anon` / `authenticated` API roles.
--
-- The server application accesses Supabase exclusively with SUPABASE_SERVICE_ROLE_KEY
-- (see lib/supabase.ts), and every other table in this project protects itself with an
-- ALL policy granted to `service_role`. We follow that exact, proven pattern here so
-- server-side reads/writes (including the *_counters tables used by the next_*()
-- SECURITY INVOKER functions) keep working unchanged while public API roles are denied.
--
-- Idempotent: safe to re-run. No data or schema changes beyond enabling RLS + policies.

-- ─────────────────────────── Lead protection settings ───────────────────────────
ALTER TABLE public.partner_lead_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_lead_settings_all" ON public.partner_lead_settings;
CREATE POLICY "sr_partner_lead_settings_all" ON public.partner_lead_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Numbering counters ─────────────────────────────────
ALTER TABLE public.quote_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_quote_number_counters_all" ON public.quote_number_counters;
CREATE POLICY "sr_quote_number_counters_all" ON public.quote_number_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_invoice_number_counters_all" ON public.invoice_number_counters;
CREATE POLICY "sr_invoice_number_counters_all" ON public.invoice_number_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.payment_reference_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_payment_reference_counters_all" ON public.payment_reference_counters;
CREATE POLICY "sr_payment_reference_counters_all" ON public.payment_reference_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.commission_payout_reference_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_commission_payout_reference_counters_all" ON public.commission_payout_reference_counters;
CREATE POLICY "sr_commission_payout_reference_counters_all" ON public.commission_payout_reference_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.support_ticket_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_support_ticket_number_counters_all" ON public.support_ticket_number_counters;
CREATE POLICY "sr_support_ticket_number_counters_all" ON public.support_ticket_number_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.lead_quotation_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_lead_quotation_counters_all" ON public.lead_quotation_counters;
CREATE POLICY "sr_lead_quotation_counters_all" ON public.lead_quotation_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Tax rates ──────────────────────────────────────────
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_tax_rates_all" ON public.tax_rates;
CREATE POLICY "sr_tax_rates_all" ON public.tax_rates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
