-- Partner operations: work orders, milestones, change orders, quotation
-- requests and certifications per the Channel & Implementation Portal
-- Automation Blueprint. Idempotent.

ALTER TABLE partner_sequences
  ADD COLUMN IF NOT EXISTS work_order_seq INTEGER NOT NULL DEFAULT 0;

-- Atomic increment for work order references (WO-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION increment_partner_work_order_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE partner_sequences
    SET work_order_seq = work_order_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING work_order_seq INTO next_val;
  RETURN next_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_partner_work_order_seq() FROM PUBLIC, anon, authenticated;

/* ───────────────────────────  Work orders  ─────────────────────────── */

CREATE TABLE IF NOT EXISTS partner_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_ref TEXT NOT NULL,                -- WO-YYYY-NNNNN (assigned at issue)
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES partner_customer_assignments(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  exclusions TEXT,
  acceptance_criteria TEXT,
  customer_duties TEXT,
  access_notes TEXT,

  fee_total NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'NGN',

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ISSUED','ACCEPTED','IN_PROGRESS','COMPLETED','CLOSED','CANCELLED')),

  starts_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,

  issued_at TIMESTAMPTZ,
  issued_by TEXT,
  partner_acknowledged_at TIMESTAMPTZ,
  partner_acknowledged_by TEXT,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,

  generated_document_id UUID REFERENCES partner_generated_documents(id) ON DELETE SET NULL,

  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pwo_partner_id_idx ON partner_work_orders (partner_id);
CREATE INDEX IF NOT EXISTS pwo_assignment_id_idx ON partner_work_orders (assignment_id);
CREATE INDEX IF NOT EXISTS pwo_business_id_idx ON partner_work_orders (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS pwo_ref_uidx ON partner_work_orders (work_order_ref);

ALTER TABLE partner_work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_work_orders_all" ON partner_work_orders;
CREATE POLICY "sr_partner_work_orders_all" ON partner_work_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ───────────────────────────  Milestones  ─────────────────────────── */

CREATE TABLE IF NOT EXISTS partner_work_order_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES partner_work_orders(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  fee_amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'NGN',
  acceptance_criteria TEXT,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','SUBMITTED','ACCEPTED','REJECTED')),

  evidence_text TEXT,
  evidence_url TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,

  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- accepted fee -> earnings pipeline (partner_commissions row)
  commission_id UUID REFERENCES partner_commissions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pwom_work_order_id_idx ON partner_work_order_milestones (work_order_id);
CREATE INDEX IF NOT EXISTS pwom_status_due_idx ON partner_work_order_milestones (status, due_date);

ALTER TABLE partner_work_order_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_work_order_milestones_all" ON partner_work_order_milestones;
CREATE POLICY "sr_partner_work_order_milestones_all" ON partner_work_order_milestones FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ───────────────────────────  Change orders  ─────────────────────────── */

CREATE TABLE IF NOT EXISTS partner_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES partner_work_orders(id) ON DELETE CASCADE,

  requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('PARTNER','ADMIN')),
  requested_by TEXT,
  description TEXT NOT NULL,
  reason TEXT,
  impact_scope TEXT,
  impact_fee NUMERIC(14,2),
  impact_schedule TEXT,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','DEFERRED')),
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,

  generated_document_id UUID REFERENCES partner_generated_documents(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pco_work_order_id_idx ON partner_change_orders (work_order_id);
CREATE INDEX IF NOT EXISTS pco_status_idx ON partner_change_orders (status);

ALTER TABLE partner_change_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_change_orders_all" ON partner_change_orders;
CREATE POLICY "sr_partner_change_orders_all" ON partner_change_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ───────────────────────────  Quotation requests  ─────────────────────────── */

CREATE TABLE IF NOT EXISTS partner_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  partner_lead_id UUID NOT NULL REFERENCES partner_leads(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES partner_users(id) ON DELETE SET NULL,

  plan_name TEXT,
  locations TEXT,
  users_estimate TEXT,
  services_requested TEXT,
  assumptions TEXT,
  notes TEXT,
  due_date DATE,

  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','UNDER_REVIEW','ISSUED','DECLINED','EXPIRED')),
  issued_quote_ref TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pqr_partner_id_idx ON partner_quote_requests (partner_id);
CREATE INDEX IF NOT EXISTS pqr_lead_id_idx ON partner_quote_requests (partner_lead_id);
CREATE INDEX IF NOT EXISTS pqr_status_idx ON partner_quote_requests (status);

ALTER TABLE partner_quote_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_quote_requests_all" ON partner_quote_requests;
CREATE POLICY "sr_partner_quote_requests_all" ON partner_quote_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ───────────────────────────  Certifications  ─────────────────────────── */

CREATE TABLE IF NOT EXISTS partner_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  programme TEXT NOT NULL DEFAULT 'IMPLEMENTATION',
  status TEXT NOT NULL DEFAULT 'CANDIDATE'
    CHECK (status IN ('CANDIDATE','TRAINING','ASSESSMENT','SUPERVISED','CERTIFIED','EXPIRED','REVOKED')),
  score NUMERIC(5,2),
  assessor TEXT,
  supervised_delivery BOOLEAN NOT NULL DEFAULT false,
  restrictions TEXT,
  notes TEXT,

  awarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  decided_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pc_partner_id_idx ON partner_certifications (partner_id);
CREATE INDEX IF NOT EXISTS pc_status_expiry_idx ON partner_certifications (status, expires_at);

ALTER TABLE partner_certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_certifications_all" ON partner_certifications;
CREATE POLICY "sr_partner_certifications_all" ON partner_certifications FOR ALL TO service_role USING (true) WITH CHECK (true);

/* ───────────────────────────  Internal implementation-fee plan  ───────────────────────────
 * Accepted work-order milestones create partner_commissions rows on this plan
 * so implementation fees flow through the same review → payout pipeline as
 * channel commission.
 */
INSERT INTO commission_plans (name, description, partner_type, commission_basis, fixed_amount, applies_to, commission_trigger, active, effective_from)
SELECT 'Internal Implementation Fee',
       'Fixed fees earned on accepted implementation work-order milestones. Not used for automatic evaluation.',
       NULL, 'FIXED', 0, 'IMPLEMENTATION', 'CUSTOMER_GO_LIVE', true, CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM commission_plans WHERE name = 'Internal Implementation Fee' AND applies_to = 'IMPLEMENTATION'
);

/* ─── Duplicate commission prevention ───
 * One commission per payment+plan — guards against double evaluation of the
 * same confirmed payment (webhook retries, admin re-confirmation).
 */
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_payment_plan_uidx
  ON partner_commissions (payment_id, commission_plan_id)
  WHERE payment_id IS NOT NULL;

/* ─── Business status fix ───
 * lib/partner-onboarding.ts already writes PARTNER_COMPLETED and
 * GO_LIVE_APPROVED into businesses.status, but the original CHECK from
 * migration 006 never allowed them — the partner go-live flow would fail at
 * runtime. Widen the constraint to match the code.
 */
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_status_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_status_check
  CHECK (status IN ('PROSPECT','ONBOARDING','PARTNER_COMPLETED','GO_LIVE_APPROVED','ACTIVE','SUSPENDED','INACTIVE','CHURNED'));

-- Idempotent reminder tracking for the partner-ops cron sweep
ALTER TABLE partner_work_order_milestones
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE partner_certifications
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE partner_leads
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ;

/* ─── Assignment acceptance gate ───
 * Blueprint: no implementation work until the partner has accepted the
 * Customer Assignment. Acceptance happens by acknowledging the generated
 * Customer Assignment document; these columns record it on the assignment.
 */
ALTER TABLE partner_customer_assignments
  ADD COLUMN IF NOT EXISTS partner_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_accepted_by TEXT,
  ADD COLUMN IF NOT EXISTS generated_document_id UUID REFERENCES partner_generated_documents(id) ON DELETE SET NULL;
