-- 088_referral_finance_and_documents.sql
-- Referral finance layer: commission earnings (approved earning statuses,
-- versioned calculation records, linked adjustments), monthly close periods,
-- payout profiles with reverification + dual approval for bank changes,
-- refund tracking on payments, and the referral document pack types.
-- Reuses partner_commissions, commission_payouts, invoices/payments and
-- partner_generated_documents — no duplicate financial tables.

/* ══════════════════════════════════════════════════════════════════════════
   1. partner_commissions — approved earning statuses + referral linkage
   ══════════════════════════════════════════════════════════════════════════ */

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'partner_commissions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''SCHEDULED''%'
  LOOP
    EXECUTE format('ALTER TABLE partner_commissions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE partner_commissions ADD CONSTRAINT partner_commissions_status_check CHECK (status IN (
  -- approved earning statuses
  'POTENTIAL','PENDING','ELIGIBLE','APPROVED','PAID','HELD','REVERSED','DISPUTED',
  -- existing pipeline values kept for legacy rows / payout scheduling
  'SCHEDULED','CANCELLED'
));

ALTER TABLE partner_commissions
  ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES partner_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES partner_commission_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS holding_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS holding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eligible_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_commission_id UUID REFERENCES partner_commissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjustment_kind TEXT
    CHECK (adjustment_kind IN ('REFUND','CREDIT','CHARGEBACK','TAX','MANUAL_OVERRIDE')),
  ADD COLUMN IF NOT EXISTS hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_approved_by UUID,
  ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earning_kind TEXT CHECK (earning_kind IN ('FIRST_YEAR','RENEWAL')),
  ADD COLUMN IF NOT EXISTS period_id UUID;

CREATE INDEX IF NOT EXISTS pc_referral_idx ON partner_commissions (referral_id) WHERE referral_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pc_schedule_idx ON partner_commissions (schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pc_status_idx ON partner_commissions (status);
CREATE INDEX IF NOT EXISTS pc_period_idx ON partner_commissions (period_id) WHERE period_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pc_parent_idx ON partner_commissions (parent_commission_id) WHERE parent_commission_id IS NOT NULL;

-- First collected renewal only: one renewal earning per partner per business.
CREATE UNIQUE INDEX IF NOT EXISTS pc_renewal_once_uidx
  ON partner_commissions (partner_id, business_id)
  WHERE earning_kind = 'RENEWAL' AND parent_commission_id IS NULL;

-- One earning per commercial event: a second confirmed payment on the same
-- invoice re-evaluates the existing row (larger cleared base) instead of
-- double-booking it.
CREATE UNIQUE INDEX IF NOT EXISTS pc_invoice_kind_uidx
  ON partner_commissions (partner_id, invoice_id, earning_kind)
  WHERE parent_commission_id IS NULL AND invoice_id IS NOT NULL AND earning_kind IS NOT NULL;

/* ══════════════════════════════════════════════════════════════════════════
   2. commission_close_periods — Finance monthly close
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS commission_close_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commission_close_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_commission_close_periods_all" ON commission_close_periods;
CREATE POLICY "sr_commission_close_periods_all" ON commission_close_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_commissions_period_id_fkey'
  ) THEN
    ALTER TABLE partner_commissions
      ADD CONSTRAINT partner_commissions_period_id_fkey
      FOREIGN KEY (period_id) REFERENCES commission_close_periods(id) ON DELETE SET NULL;
  END IF;
END $$;

/* ══════════════════════════════════════════════════════════════════════════
   3. Refunds and chargebacks on payments (base reduction source)
   ══════════════════════════════════════════════════════════════════════════ */

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

/* ══════════════════════════════════════════════════════════════════════════
   4. Payout profiles + bank-detail changes (reverification + dual approval)
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS partner_payout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  payout_contact_name TEXT NOT NULL DEFAULT '',
  payout_contact_email TEXT NOT NULL DEFAULT '',
  payout_contact_phone TEXT NOT NULL DEFAULT '',
  tax_reference TEXT NOT NULL DEFAULT '',
  tax_details_verified BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
  verification_notes TEXT NOT NULL DEFAULT '',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_payout_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_payout_profiles_all" ON partner_payout_profiles;
CREATE POLICY "sr_partner_payout_profiles_all" ON partner_payout_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS partner_bank_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  requested_by UUID,
  requested_by_name TEXT NOT NULL DEFAULT '',
  old_bank_name TEXT NOT NULL DEFAULT '',
  old_account_last4 TEXT NOT NULL DEFAULT '',
  new_bank_name TEXT NOT NULL DEFAULT '',
  new_account_number TEXT NOT NULL DEFAULT '',
  new_account_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','REVERIFICATION_REQUIRED','APPROVED','REJECTED','CANCELLED')),
  reverified_by UUID,
  reverified_at TIMESTAMPTZ,
  first_approval_by UUID,
  first_approval_at TIMESTAMPTZ,
  second_approval_by UUID,
  second_approval_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pbcr_partner_idx ON partner_bank_change_requests (partner_id, status);

ALTER TABLE partner_bank_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_bank_change_requests_all" ON partner_bank_change_requests;
CREATE POLICY "sr_partner_bank_change_requests_all" ON partner_bank_change_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ══════════════════════════════════════════════════════════════════════════
   5. Referral document pack types on partner_generated_documents
   ══════════════════════════════════════════════════════════════════════════ */

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'partner_generated_documents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''MASTER_PARTNER_AGREEMENT''%'
  LOOP
    EXECUTE format('ALTER TABLE partner_generated_documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE partner_generated_documents ADD CONSTRAINT partner_generated_documents_document_type_check CHECK (document_type IN (
  'MASTER_PARTNER_AGREEMENT',
  'ACTIVATION_CONFIRMATION',
  'CUSTOMER_ASSIGNMENT',
  'IMPLEMENTATION_WORK_ORDER',
  'CHANGE_ORDER',
  'DATA_PROCESSING_ADDENDUM',
  'TRAINING_RECORD',
  'UAT_RECORD',
  'COMPLETION_HANDOVER_RECORD',
  'GO_LIVE_DECISION',
  'COMMISSION_STATEMENT',
  'IMPLEMENTATION_FEE_STATEMENT',
  'PAYOUT_STATEMENT',
  'GRADE_CONFIRMATION',
  'FORMAL_NOTICE',
  -- referral partner pack
  'REFERRAL_PARTNER_AGREEMENT',
  'REFERRAL_COMMISSION_SCHEDULE',
  'REFERRAL_ACCEPTANCE_NOTICE',
  'INFORMATION_REQUEST_NOTICE',
  'DUPLICATE_NOTICE',
  'REJECTION_NOTICE',
  'LOST_OR_EXPIRED_NOTICE',
  'SUSPENSION_OR_TERMINATION_NOTICE',
  'REFERRAL_COMMISSION_STATEMENT'
));

ALTER TABLE partner_generated_documents
  ADD COLUMN IF NOT EXISTS approver_name TEXT,
  ADD COLUMN IF NOT EXISTS signatory_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

/* ══════════════════════════════════════════════════════════════════════════
   6. Referral commission plan categories (NOT auto-evaluated)
   Rates are controlled by the signed Commission Schedule; these rows only
   categorise earnings. Trigger is CUSTOM so the generic
   PAYMENT_CONFIRMED evaluator never books referral earnings.
   ══════════════════════════════════════════════════════════════════════════ */

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'commission_plans'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''PAYMENT_CONFIRMED''%'
      AND pg_get_constraintdef(oid) NOT LIKE '%''CUSTOM''%'
  LOOP
    EXECUTE format('ALTER TABLE commission_plans DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE commission_plans
  ADD CONSTRAINT commission_plans_commission_trigger_check CHECK (commission_trigger IN (
    -- automatic evaluation triggers
    'PAYMENT_CONFIRMED','SUBSCRIPTION_ACTIVATED','CUSTOMER_GO_LIVE',
    -- categorisation-only plans whose rate lives in the signed schedule
    'CUSTOM'
  ));

INSERT INTO commission_plans (name, description, partner_type, commission_basis, percentage, applies_to, commission_trigger, active, effective_from)
SELECT
  'Referral Software First-Year Commission',
  'Categorises first-year referral earnings. Rate is read from the active signed Referral Commission Schedule (standard 10%).',
  'REFERRAL', 'PERCENTAGE', 10.0000, 'INITIAL_LICENSE', 'CUSTOM', true, CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM commission_plans WHERE name = 'Referral Software First-Year Commission'
);

INSERT INTO commission_plans (name, description, partner_type, commission_basis, percentage, applies_to, commission_trigger, active, effective_from)
SELECT
  'Referral Software First-Renewal Commission',
  'Categorises the first collected renewal referral earning only. Rate is read from the active signed Referral Commission Schedule (standard 5%).',
  'REFERRAL', 'PERCENTAGE', 5.0000, 'RENEWAL', 'CUSTOM', true, CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM commission_plans WHERE name = 'Referral Software First-Renewal Commission'
);

/* ══════════════════════════════════════════════════════════════════════════
   7. Backfill: standard Commission Schedules for existing ACTIVE partners
   of type REFERRAL, so attribution already earned keeps evaluating under
   the approved standard rules (10% / 5% / 90d / 30d / 14d) as data rows —
   never hard-coded in application logic.
   ══════════════════════════════════════════════════════════════════════════ */

INSERT INTO partner_commission_schedules (
  reference_number, partner_id, version, status,
  first_year_rate, first_renewal_rate, protection_days, holding_days,
  payout_days_after_month_end, effective_from, executed_at, notes, created_at, updated_at
)
SELECT
  'MCS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD((p.seq)::text, 5, '0'),
  p.id,
  1,
  'EXECUTED',
  10.0000, 5.0000, 90, 30, 14,
  p.effective_from,
  now(),
  'Standard terms backfilled by migration 088 for pre-existing Referral Partner. Superseded by a newly signed schedule when issued.',
  now(),
  now()
FROM (
  SELECT pa.id,
         COALESCE(pa.partner_since, pa.created_at)::date AS effective_from,
         ROW_NUMBER() OVER (ORDER BY pa.created_at) AS seq
  FROM partners pa
  WHERE pa.partner_type = 'REFERRAL'
    AND pa.status IN ('ACTIVE','PENDING_ACTIVATION')
    AND NOT EXISTS (
      SELECT 1 FROM partner_commission_schedules s WHERE s.partner_id = pa.id
    )
) p;

/* ══════════════════════════════════════════════════════════════════════════
   8. Backfill: executed Referral Partner Agreement for the same partners.
   Without it the agreement gate would hold every existing attribution, so the
   already-signed standard agreement is represented as data (ACTIVE) rather
   than special-cased in application logic.
   ══════════════════════════════════════════════════════════════════════════ */

INSERT INTO partner_agreements (
  reference_number, partner_id, agreement_kind, title, version, status,
  executed_at, activated_at, notes, created_at, updated_at
)
SELECT
  'AGR-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD((p.seq)::text, 5, '0'),
  p.id,
  'REFERRAL_PARTNER_AGREEMENT',
  'Referral Partner Agreement',
  1,
  'ACTIVE',
  now(),
  now(),
  'Agreement in force backfilled by migration 088 for a pre-existing Referral Partner. Replaced by a newly executed agreement when one is issued.',
  now(),
  now()
FROM (
  SELECT pa.id,
         ROW_NUMBER() OVER (ORDER BY pa.created_at) AS seq
  FROM partners pa
  WHERE pa.partner_type = 'REFERRAL'
    AND pa.status IN ('ACTIVE','PENDING_ACTIVATION')
    AND NOT EXISTS (
      SELECT 1 FROM partner_agreements g
      WHERE g.partner_id = pa.id AND g.agreement_kind = 'REFERRAL_PARTNER_AGREEMENT'
    )
) p;

/* ══════════════════════════════════════════════════════════════════════════
   9. Backfill: payout profile rows (deliberately NOT verified).
   Finance must reverify bank, payout contact and tax details before any
   approval — these rows open the queue, they do not grant the gate.
   ══════════════════════════════════════════════════════════════════════════ */

INSERT INTO partner_payout_profiles (
  partner_id, payout_contact_name, payout_contact_email, verification_status, created_at, updated_at
)
SELECT
  p.id,
  '',
  COALESCE(p.public_email, ''),
  'PENDING',
  now(),
  now()
FROM partners p
WHERE p.partner_type = 'REFERRAL'
  AND p.status IN ('ACTIVE','PENDING_ACTIVATION')
  AND NOT EXISTS (
    SELECT 1 FROM partner_payout_profiles pp WHERE pp.partner_id = p.id
  );
