-- Partner payout (withdrawal) requests
-- Partners request withdrawal of their APPROVED commission balance; admins
-- review and, on approval, generate a commission_payouts batch.

CREATE TABLE IF NOT EXISTS partner_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES partner_users(id) ON DELETE SET NULL,

  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')),

  notes TEXT,
  review_notes TEXT,

  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,

  payout_id UUID REFERENCES commission_payouts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ppr_partner_id_idx ON partner_payout_requests (partner_id);
CREATE INDEX IF NOT EXISTS ppr_status_idx ON partner_payout_requests (status);

ALTER TABLE partner_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_payout_requests_all" ON partner_payout_requests;
CREATE POLICY "sr_partner_payout_requests_all" ON partner_payout_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
