-- Partner application follow-up question rounds and partner-owned support tickets.

CREATE TABLE IF NOT EXISTS partner_application_question_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Additional Questions',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'Sent' CHECK (status IN ('Sent','Submitted','Reviewed')),
  sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_app_question_rounds_app_idx
  ON partner_application_question_rounds (application_id, created_at DESC);
ALTER TABLE partner_application_question_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_application_question_rounds_all" ON partner_application_question_rounds;
CREATE POLICY "sr_partner_application_question_rounds_all" ON partner_application_question_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS requester_partner_id UUID REFERENCES partners(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS support_tickets_requester_partner_idx ON support_tickets (requester_partner_id, created_at DESC);

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_owner_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_owner_check
  CHECK (((business_id IS NOT NULL)::int + (creator_id IS NOT NULL)::int + (requester_partner_id IS NOT NULL)::int) = 1);

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN (
    'SOFTWARE','LOGIN_ACCOUNT','POS','INVENTORY','PRODUCTS','REPORTS','ONLINE_STORE',
    'CONFIGURATION','TRAINING','BILLING','LICENSING','SECURITY','PRIVACY_DATA',
    'HARDWARE_GUIDANCE','FEATURE_REQUEST','PARTNER_COMPLAINT','CREATOR_NETWORK','PARTNER_NETWORK','OTHER'
  ));

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_partner_category_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_partner_category_check
  CHECK ((category = 'PARTNER_NETWORK') = (requester_partner_id IS NOT NULL));
