-- Lead meeting / calendar scheduling
-- Lets admins schedule meetings for leads, store a customer-facing token,
-- and track the meeting status from request through completion.

CREATE TABLE IF NOT EXISTS lead_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'MartPoint Demo',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  meeting_link TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_meetings_lead_id_idx ON lead_meetings (lead_id);
CREATE INDEX IF NOT EXISTS lead_meetings_scheduled_at_idx ON lead_meetings (scheduled_at);
CREATE INDEX IF NOT EXISTS lead_meetings_customer_token_idx ON lead_meetings (customer_token);
CREATE INDEX IF NOT EXISTS lead_meetings_status_idx ON lead_meetings (status);

ALTER TABLE lead_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_lead_meetings_all" ON lead_meetings;
CREATE POLICY "sr_lead_meetings_all" ON lead_meetings FOR ALL TO service_role USING (true) WITH CHECK (true);
