-- Short-lived requests created by an authenticated browser agent and consumed
-- once by the Africa's Talking Events URL. No additional call platform needed.
CREATE TABLE IF NOT EXISTS azera_call_control_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_destination TEXT NOT NULL,
  target_queue TEXT NOT NULL CHECK (target_queue IN ('sales','support','onboarding','customer_support')),
  mode TEXT NOT NULL CHECK (mode IN ('transfer', 'conference')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS azera_call_control_requests_pending_idx
  ON azera_call_control_requests (call_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE azera_call_control_requests
  ADD COLUMN IF NOT EXISTS target_queue TEXT;

ALTER TABLE azera_call_control_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON azera_call_control_requests FROM anon, authenticated;
GRANT ALL ON azera_call_control_requests TO service_role;
DROP POLICY IF EXISTS sr_azera_call_control_requests ON azera_call_control_requests;
CREATE POLICY sr_azera_call_control_requests
  ON azera_call_control_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

NOTIFY pgrst,'reload schema';
