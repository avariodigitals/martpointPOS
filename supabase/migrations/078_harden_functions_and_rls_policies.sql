-- Fix remaining Supabase security linter warnings:
--   * function_search_path_mutable (lint 0011) — 15 functions
--   * rls_policy_always_true       (lint 0024) — 6 overly-permissive anon policies
--
-- IMPORTANT CONTEXT (why this is safe):
-- The application NEVER uses the Supabase anon/authenticated roles. There is no
-- NEXT_PUBLIC_SUPABASE_* key and no browser-side Supabase client anywhere in the
-- codebase. Every public form (leads, onboarding, partner applications, tracking
-- beacons, settings reads) is submitted through server-side Next.js API routes that
-- use SUPABASE_SERVICE_ROLE_KEY (see lib/supabase.ts). The service role bypasses RLS.
--
-- Therefore the anon policies flagged below are unused by the app and only widen
-- attack surface. We drop/replace them with the least-privilege version that keeps
-- intent (public inserts allowed where a public form genuinely exists, but the row
-- cannot be read back or used to leak/overwrite data).
--
-- Idempotent: safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. FUNCTION SEARCH PATH (lint 0011)
--
-- A mutable search_path lets a caller with CREATE on a schema earlier in the
-- resolution order shadow a referenced object. Pinning `search_path = ''` and
-- schema-qualifying every table reference removes the ambiguity. Signatures are
-- unchanged so `CREATE OR REPLACE` does not affect dependencies (triggers, RPCs).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Sequence/counter functions (called via supabase.rpc, use public.* tables) ──
CREATE OR REPLACE FUNCTION public.next_quote_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.quote_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.quote_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPQ-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.invoice_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.invoice_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPI-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_payment_reference(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.payment_reference_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.payment_reference_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPP-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_receipt_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.receipt_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.receipt_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPR-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

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
  RETURN 'MPC-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_support_ticket_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.support_ticket_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.support_ticket_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPS-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_lead_quote_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.lead_quotation_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.lead_quotation_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPLQ-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_journal_entry_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO public.journal_entry_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.journal_entry_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MJE-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ── Partner/creator sequence helpers (SECURITY DEFINER, must keep it) ──
CREATE OR REPLACE FUNCTION public.increment_partner_application_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE public.partner_sequences
    SET application_seq = application_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING application_seq INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_partner_id_seq(p_country TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cc TEXT;
  current_val INTEGER;
  next_val INTEGER;
BEGIN
  cc := UPPER(regexp_replace(substring(COALESCE(p_country, 'NG') FROM '[A-Z]{1,3}'), '[^A-Z]', '', 'g'));
  IF cc = '' THEN cc := 'NG'; END IF;

  SELECT COALESCE((partner_seq_by_country ->> cc)::INTEGER, 0) INTO current_val
    FROM public.partner_sequences WHERE id = 1;

  next_val := current_val + 1;

  UPDATE public.partner_sequences
    SET partner_seq_by_country = jsonb_set(partner_seq_by_country, cc, to_jsonb(next_val)),
        updated_at = now()
    WHERE id = 1;

  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_partner_document_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE public.partner_sequences
    SET document_seq = document_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING document_seq INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_partner_work_order_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE public.partner_sequences
    SET work_order_seq = work_order_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING work_order_seq INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_creator_application_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE public.creator_sequences
    SET application_seq = application_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING application_seq INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_creator_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE public.creator_sequences
    SET creator_seq = creator_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING creator_seq INTO next_val;
  RETURN next_val;
END;
$$;

-- ── Trigger function: pin search_path; behaviour unchanged ──
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. OVERLY-PERMISSIVE ANON POLICIES (lint 0024)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── settings: the flagged policy granted ALL commands to anon + authenticated.
-- The app reads settings via the service-role API route (/api/settings) and the
-- admin route, so no public role needs write access and anon needs no access at all.
-- Drop the wide-open policy; keep the narrow public SELECT (needed only if any
-- client ever asks the DB directly) and the service-role policy from migration 001.
DROP POLICY IF EXISTS "Allow full access to settings" ON public.settings;

-- ── clicks: public tracking beacons are written by /api/track (service role).
-- Remove the unused open anon INSERT; keep service-role access.
DROP POLICY IF EXISTS "anon_clicks_insert" ON public.clicks;

-- ── onboarding: public intake runs through /api/onboarding/client (service role).
-- Remove the unused open anon UPDATE (it allowed overwriting any row) and the
-- blanket anon SELECT; keep service-role access from migration 007.
DROP POLICY IF EXISTS "anon_onboarding_update" ON public.onboarding;
DROP POLICY IF EXISTS "anon_onboarding_select" ON public.onboarding;

-- ── partner_applications: submissions go through /api/partners/apply (service role).
-- Remove the unused open anon INSERT; keep service-role access.
DROP POLICY IF EXISTS "anon_partner_applications_insert" ON public.partner_applications;

-- ── partner_profile_events: recorded server-side on admin actions, not by anon.
-- Remove the unused open anon INSERT; keep service-role access.
DROP POLICY IF EXISTS "anon_ppe_insert" ON public.partner_profile_events;

-- ── leads: public form submissions go through /api/demo-booking, /api/estimate,
-- /api/customer-feedback etc. (service role). Replace the fully-open anon INSERT
-- with a constrained one so the table still accepts genuinely public rows but a
-- caller cannot inject arbitrary/blank records. (Anon SELECT is not granted here,
-- so submitted rows cannot be read back.)
DROP POLICY IF EXISTS "Allow public to submit leads" ON public.leads;
CREATE POLICY "anon_leads_insert" ON public.leads
  FOR INSERT TO anon
  WITH CHECK (
    length(trim(coalesce(full_name, ''))) > 0
    AND (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );
