-- Outbound follow-up campaigns run through Africa's Talking Voice API.
-- Campaign calls use short spoken prompts and keypad responses; this schema
-- does not claim speech recognition or live AI conversation.

CREATE TABLE IF NOT EXISTS azera_call_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('estimate_followup','quote_followup','lead_reengagement')),
  goal TEXT NOT NULL,
  script_template TEXT NOT NULL DEFAULT '',
  audience_days INTEGER NOT NULL DEFAULT 14 CHECK (audience_days BETWEEN 1 AND 365),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed','failed')),
  target_count INTEGER NOT NULL DEFAULT 0,
  max_calls INTEGER NOT NULL DEFAULT 25 CHECK (max_calls BETWEEN 1 AND 100),
  window_start TIME NOT NULL DEFAULT '09:00',
  window_end TIME NOT NULL DEFAULT '17:00',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (window_start < window_end)
);

CREATE TABLE IF NOT EXISTS azera_call_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES azera_call_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  product_interest TEXT NOT NULL DEFAULT '',
  estimate_snapshot JSONB NOT NULL DEFAULT '{}',
  personalized_script TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','dialing','answered','callback_requested','not_interested','no_response','failed','suppressed')),
  response_digit TEXT CHECK (response_digit IN ('1','2','3')),
  response_label TEXT,
  call_id UUID,
  notes TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 1),
  provider_error TEXT,
  answered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);

CREATE TABLE IF NOT EXISTS azera_call_suppressions (
  phone TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT 'recipient_request',
  source_campaign_id UUID REFERENCES azera_call_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS campaign_recipient_id UUID REFERENCES azera_call_campaign_recipients(id) ON DELETE SET NULL;

ALTER TABLE azera_call_attempts DROP CONSTRAINT IF EXISTS azera_call_attempts_status_check;
ALTER TABLE azera_call_attempts ADD CONSTRAINT azera_call_attempts_status_check
  CHECK (status IN ('queued','dialing','ringing','answered','busy','rejected','no_answer','failed'));

CREATE INDEX IF NOT EXISTS azera_call_campaigns_business_idx
  ON azera_call_campaigns (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS azera_call_campaign_recipients_campaign_idx
  ON azera_call_campaign_recipients (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS azera_call_campaign_recipients_queue_idx
  ON azera_call_campaign_recipients (status, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS azera_calls_campaign_recipient_idx
  ON azera_calls (campaign_recipient_id) WHERE campaign_recipient_id IS NOT NULL;

ALTER TABLE azera_call_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE azera_call_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE azera_call_suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_azera_call_campaigns ON azera_call_campaigns;
CREATE POLICY sr_azera_call_campaigns ON azera_call_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_azera_call_campaign_recipients ON azera_call_campaign_recipients;
CREATE POLICY sr_azera_call_campaign_recipients ON azera_call_campaign_recipients FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_azera_call_suppressions ON azera_call_suppressions;
CREATE POLICY sr_azera_call_suppressions ON azera_call_suppressions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- One worker claims at most one recipient per invocation. Row locks prevent
-- overlapping Vercel cron invocations from placing duplicate calls.
CREATE OR REPLACE FUNCTION azera_claim_campaign_recipient()
RETURNS SETOF azera_call_campaign_recipients
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed azera_call_campaign_recipients%ROWTYPE;
BEGIN
  SELECT r.* INTO claimed
  FROM azera_call_campaign_recipients r
  JOIN azera_call_campaigns c ON c.id = r.campaign_id
  WHERE r.status = 'queued' AND c.status = 'running'
    AND r.attempt_count = 0
    AND NOT EXISTS (
      SELECT 1 FROM azera_call_suppressions s
      WHERE s.phone = r.phone
    )
    AND NOT EXISTS (
      SELECT 1 FROM azera_calls previous
      WHERE previous.sip_provider = 'africas_talking_campaign'
        AND previous.customer_phone = r.phone
        AND previous.created_at > now() - INTERVAL '30 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM azera_calls a
      WHERE a.sip_provider = 'africas_talking_campaign'
        AND a.status IN ('ringing','active')
    )
  ORDER BY c.started_at, r.created_at
  LIMIT 1
  FOR UPDATE OF r SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE azera_call_campaign_recipients
  SET status = 'dialing', attempt_count = 1, updated_at = now()
  WHERE id = claimed.id
  RETURNING * INTO claimed;
  RETURN NEXT claimed;
END $$;
REVOKE ALL ON FUNCTION azera_claim_campaign_recipient() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION azera_claim_campaign_recipient() TO service_role;

NOTIFY pgrst, 'reload schema';
