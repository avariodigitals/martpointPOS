-- Partner Prospect pipeline: capture and track potential partners before the formal application.

CREATE TABLE IF NOT EXISTS partner_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  source TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  business_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  state TEXT,
  city TEXT,
  interested_partner_type TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'NEW_LEAD'
    CHECK (status IN ('NEW_LEAD','CONTACTED','INTERESTED','INVITED_TO_APPLY','APPLICATION_SUBMITTED','CONVERTED','NOT_INTERESTED','DISQUALIFIED')),
  notes TEXT,
  next_follow_up TIMESTAMPTZ,
  invite_token TEXT UNIQUE,
  invited_at TIMESTAMPTZ,
  linked_application_id UUID REFERENCES partner_applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_prospects_status_idx ON partner_prospects (status);
CREATE INDEX IF NOT EXISTS partner_prospects_owner_idx ON partner_prospects (owner);
CREATE INDEX IF NOT EXISTS partner_prospects_invite_token_idx ON partner_prospects (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_prospects_follow_up_idx ON partner_prospects (next_follow_up) WHERE next_follow_up IS NOT NULL;

ALTER TABLE partner_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_prospects_all" ON partner_prospects;
CREATE POLICY "sr_partner_prospects_all" ON partner_prospects FOR ALL TO service_role USING (true) WITH CHECK (true);
