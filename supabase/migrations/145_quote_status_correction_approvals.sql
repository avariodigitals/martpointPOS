-- Audited correction workflow for quotes accepted in error. Only Admin may
-- apply a correction; other quote staff can submit a reasoned approval request.
CREATE TABLE IF NOT EXISTS quote_status_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('lead_quote','finance_quote')),
  quote_id UUID NOT NULL,
  quote_number TEXT NOT NULL,
  from_status TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (from_status = 'ACCEPTED'),
  to_status TEXT NOT NULL CHECK (to_status IN ('SENT','DECLINED','EXPIRED')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 8),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','FAILED')),
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
CREATE UNIQUE INDEX IF NOT EXISTS quote_status_one_pending_correction
  ON quote_status_correction_requests(source_type, quote_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS quote_status_correction_inbox_idx
  ON quote_status_correction_requests(status, requested_at DESC);
ALTER TABLE quote_status_correction_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON quote_status_correction_requests FROM anon, authenticated;
GRANT ALL ON quote_status_correction_requests TO service_role;
DROP POLICY IF EXISTS sr_quote_status_correction_requests ON quote_status_correction_requests;
CREATE POLICY sr_quote_status_correction_requests ON quote_status_correction_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);
