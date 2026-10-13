-- 087_referral_partner_workflow.sql
-- Referral Partner workflow: referral submission/attribution on partner_leads,
-- referral status history, agreement workflow, commission schedules, grades,
-- partner notifications and reference sequences.
-- Reuses partner_leads (no duplicate referral table), partner_applications,
-- partner_generated_documents and partner_status_history where they exist.
-- Additive and idempotent.

/* ══════════════════════════════════════════════════════════════════════════
   1. partner_leads — referral submission form, decisions & attribution
   ══════════════════════════════════════════════════════════════════════════ */

-- Widen the status CHECK to the approved Referral workflow statuses while
-- keeping the legacy partner-lead pipeline values for existing rows.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'partner_leads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''REGISTERED''%'
  LOOP
    EXECUTE format('ALTER TABLE partner_leads DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE partner_leads ADD CONSTRAINT partner_leads_status_check CHECK (status IN (
  -- legacy partner-lead pipeline (kept for existing rows / non-referral types)
  'REGISTERED','UNDER_REVIEW','QUALIFIED','DEMO','PROPOSAL','NEGOTIATION','WON','LOST','EXPIRED',
  -- approved Referral Partner workflow
  'DRAFT','SUBMITTED','INFORMATION_REQUIRED','ACCEPTED','DUPLICATE','REJECTED',
  'CONVERTED_UNPAID','PAID_PENDING_ACTIVATION','ACTIVATED_HOLDING','COMMISSION_ELIGIBLE',
  'APPROVED','PAID'
));

ALTER TABLE partner_leads
  ADD COLUMN IF NOT EXISTS referral_reference TEXT,
  ADD COLUMN IF NOT EXISTS consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_system TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS known_requirement TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS relationship_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acceptance_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS protection_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS protection_extended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS protection_extension_reason TEXT,
  ADD COLUMN IF NOT EXISTS information_request_message TEXT,
  ADD COLUMN IF NOT EXISTS information_request_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS information_response TEXT,
  ADD COLUMN IF NOT EXISTS information_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decision_by UUID,
  ADD COLUMN IF NOT EXISTS decision_by_name TEXT,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS closure_reason TEXT,
  ADD COLUMN IF NOT EXISTS sales_owner TEXT,
  ADD COLUMN IF NOT EXISTS converted_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS partner_leads_referral_reference_uidx
  ON partner_leads (referral_reference) WHERE referral_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_leads_status_idx ON partner_leads (status);
CREATE INDEX IF NOT EXISTS partner_leads_acceptance_idx ON partner_leads (acceptance_at) WHERE acceptance_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_leads_protection_expiry_idx ON partner_leads (protection_expires_at)
  WHERE protection_expires_at IS NOT NULL AND status = 'ACCEPTED';

-- Supporting evidence attaches to a referral (reuses partner_documents).
ALTER TABLE partner_documents ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES partner_leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pd_lead_id_idx ON partner_documents (lead_id) WHERE lead_id IS NOT NULL;

/* ══════════════════════════════════════════════════════════════════════════
   2. referral_status_history — complete, immutable status history
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS referral_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES partner_leads(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ADMIN','SYSTEM','PARTNER')),
  actor_id UUID,
  actor_name TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rsh_referral_idx ON referral_status_history (referral_id, created_at DESC);

ALTER TABLE referral_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_referral_status_history_all" ON referral_status_history;
CREATE POLICY "sr_referral_status_history_all" ON referral_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ══════════════════════════════════════════════════════════════════════════
   3. partner_agreements — agreement + commission schedule workflow
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS partner_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  application_id UUID REFERENCES partner_applications(id) ON DELETE CASCADE,
  agreement_kind TEXT NOT NULL
    CHECK (agreement_kind IN ('REFERRAL_PARTNER_AGREEMENT','REFERRAL_COMMISSION_SCHEDULE')),
  title TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','LEGAL_REVIEW','COMMERCIAL_REVIEW','APPROVED_FOR_SIGNATURE','SENT_FOR_SIGNATURE',
      'PARTIALLY_SIGNED','EXECUTED','ACTIVE','SUSPENDED','SUPERSEDED','TERMINATED','EXPIRED'
    )),
  document_id UUID REFERENCES partner_generated_documents(id) ON DELETE SET NULL,
  legal_reviewed_by UUID,
  legal_reviewed_at TIMESTAMPTZ,
  commercial_reviewed_by UUID,
  commercial_reviewed_at TIMESTAMPTZ,
  approved_for_signature_by UUID,
  approved_for_signature_at TIMESTAMPTZ,
  sent_for_signature_at TIMESTAMPTZ,
  martpoint_signed_at TIMESTAMPTZ,
  partner_signed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES partner_agreements(id) ON DELETE SET NULL,
  suspension_reason TEXT,
  termination_reason TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paagr_partner_idx ON partner_agreements (partner_id, agreement_kind);
CREATE INDEX IF NOT EXISTS paagr_application_idx ON partner_agreements (application_id, agreement_kind);
CREATE INDEX IF NOT EXISTS paagr_status_idx ON partner_agreements (status);

ALTER TABLE partner_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_agreements_all" ON partner_agreements;
CREATE POLICY "sr_partner_agreements_all" ON partner_agreements FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ══════════════════════════════════════════════════════════════════════════
   4. partner_commission_schedules — the signed commercial terms
   Rate, protection, holding and payout timing are read from the active
   EXECUTED schedule at evaluation time. Nothing here is hard-coded in
   application logic; partner-specific exceptions live only in these rows.
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS partner_commission_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES partner_agreements(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','LEGAL_REVIEW','COMMERCIAL_REVIEW','APPROVED_FOR_SIGNATURE','SENT_FOR_SIGNATURE',
      'PARTIALLY_SIGNED','EXECUTED','ACTIVE','SUSPENDED','SUPERSEDED','TERMINATED','EXPIRED'
    )),
  -- standard approved commercial rules (data, not code)
  first_year_rate NUMERIC(6,4) NOT NULL DEFAULT 10.0000,
  first_renewal_rate NUMERIC(6,4) NOT NULL DEFAULT 5.0000,
  revenue_basis TEXT NOT NULL DEFAULT 'ELIGIBLE_COLLECTED_SOFTWARE_REVENUE',
  eligible_items TEXT NOT NULL DEFAULT 'MartPoint software licence and subscription lines',
  exclusions TEXT NOT NULL DEFAULT 'VAT and other taxes, refunds, credits, chargebacks, payment-processing charges, hardware, logistics, implementation, training, data migration, third-party services, finance charges, unsupported custom work',
  protection_days INTEGER NOT NULL DEFAULT 90,
  holding_days INTEGER NOT NULL DEFAULT 30,
  payout_days_after_month_end INTEGER NOT NULL DEFAULT 14,
  renewal_rule TEXT NOT NULL DEFAULT 'FIRST_COLLECTED_RENEWAL_ONLY',
  statement_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
  approved_split TEXT NOT NULL DEFAULT '',
  effective_from DATE,
  effective_to DATE,
  executed_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES partner_commission_schedules(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pcs_partner_idx ON partner_commission_schedules (partner_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS pcs_partner_version_uidx
  ON partner_commission_schedules (partner_id, version);

ALTER TABLE partner_commission_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_commission_schedules_all" ON partner_commission_schedules;
CREATE POLICY "sr_partner_commission_schedules_all" ON partner_commission_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ══════════════════════════════════════════════════════════════════════════
   5. Partner grades (Referral Partner type only)
   ══════════════════════════════════════════════════════════════════════════ */

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS current_grade TEXT
    CHECK (current_grade IN ('SILVER','GOLD','PLATINUM','DIAMOND')),
  ADD COLUMN IF NOT EXISTS grade_review_date DATE;

CREATE TABLE IF NOT EXISTS partner_grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  previous_grade TEXT,
  new_grade TEXT NOT NULL CHECK (new_grade IN ('SILVER','GOLD','PLATINUM','DIAMOND')),
  review_period TEXT NOT NULL DEFAULT '',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  next_review_date DATE,
  decision_reason TEXT NOT NULL DEFAULT '',
  decided_by UUID,
  decided_by_name TEXT,
  document_id UUID REFERENCES partner_generated_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pgh_partner_idx ON partner_grade_history (partner_id, created_at DESC);

ALTER TABLE partner_grade_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_grade_history_all" ON partner_grade_history;
CREATE POLICY "sr_partner_grade_history_all" ON partner_grade_history FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ══════════════════════════════════════════════════════════════════════════
   6. Partner notifications (in-app feed for the partner portal)
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS partner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  source_type TEXT,
  source_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pnot_partner_idx ON partner_notifications (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pnot_unread_idx ON partner_notifications (partner_id, is_read) WHERE is_read = false;

ALTER TABLE partner_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_notifications_all" ON partner_notifications;
CREATE POLICY "sr_partner_notifications_all" ON partner_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ══════════════════════════════════════════════════════════════════════════
   7. Activation gate columns on partner_applications (Referral activation)
   Identity + agreement + schedule + payout/tax + orientation + conduct.
   ══════════════════════════════════════════════════════════════════════════ */

ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS orientation_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conduct_acknowledged_at TIMESTAMPTZ;

/* ══════════════════════════════════════════════════════════════════════════
   8. Reference sequences (MPR / AGR / MCS)
   ══════════════════════════════════════════════════════════════════════════ */

ALTER TABLE partner_sequences
  ADD COLUMN IF NOT EXISTS referral_seq INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreement_seq INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS schedule_seq INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_referral_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE next_val INTEGER;
BEGIN
  UPDATE partner_sequences
    SET referral_seq = referral_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING referral_seq INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION increment_agreement_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE next_val INTEGER;
BEGIN
  UPDATE partner_sequences
    SET agreement_seq = agreement_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING agreement_seq INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION increment_schedule_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE next_val INTEGER;
BEGIN
  UPDATE partner_sequences
    SET schedule_seq = schedule_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING schedule_seq INTO next_val;
  RETURN next_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_referral_seq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_agreement_seq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_schedule_seq() FROM PUBLIC, anon, authenticated;

/* ══════════════════════════════════════════════════════════════════════════
   9. Immutability — audit & status history are append-only
   ══════════════════════════════════════════════════════════════════════════ */

CREATE OR REPLACE FUNCTION prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; rows cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_mutation();

DROP TRIGGER IF EXISTS referral_status_history_immutable ON referral_status_history;
CREATE TRIGGER referral_status_history_immutable
  BEFORE UPDATE OR DELETE ON referral_status_history
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_mutation();
