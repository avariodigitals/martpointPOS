-- Configurable approval rules and an auditable request inbox. The first
-- enforced actions cover invoice changes and high-impact finance transitions.
CREATE TABLE IF NOT EXISTS approval_policies (
  action_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  approver_roles TEXT[] NOT NULL DEFAULT ARRAY['Admin','Finance']::TEXT[],
  approver_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_reference TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL CHECK(length(trim(reason)) >= 5),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED','FAILED')),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_by_name TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS approval_one_pending_per_action_entity
  ON approval_requests(action_key, entity_type, entity_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS approval_requests_inbox_idx ON approval_requests(status, requested_at DESC);

ALTER TABLE approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON approval_policies, approval_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON approval_policies, approval_requests TO service_role;
DROP POLICY IF EXISTS sr_approval_policies_all ON approval_policies;
CREATE POLICY sr_approval_policies_all ON approval_policies FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_approval_requests_all ON approval_requests;
CREATE POLICY sr_approval_requests_all ON approval_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO approval_policies(action_key,label,enabled,approver_roles) VALUES
  ('finance.invoice.cancel','Cancel an invoice',true,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.invoice.void','Void an invoice',false,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.invoice.waive','Waive an invoice',false,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.payment.confirm','Confirm a payment',false,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.payment.reverse','Reverse a payment',true,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.subscription.waive','Waive a subscription',true,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.subscription.suspend','Suspend a subscription',false,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.subscription.cancel','Cancel a subscription',true,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.commission.approve','Approve a commission',false,ARRAY['Admin','Finance']::TEXT[]),
  ('finance.payout.mark_paid','Mark a payout paid',true,ARRAY['Admin','Finance']::TEXT[])
ON CONFLICT(action_key) DO NOTHING;
NOTIFY pgrst,'reload schema';
