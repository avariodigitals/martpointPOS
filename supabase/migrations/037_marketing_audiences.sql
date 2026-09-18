-- Email marketing: saved audiences (contact lists), and preheader +
-- audience link on campaigns. Idempotent and additive.

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS preheader TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audience_id UUID;

CREATE TABLE IF NOT EXISTS marketing_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_marketing_audiences_all" ON marketing_audiences;
CREATE POLICY "sr_marketing_audiences_all" ON marketing_audiences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID NOT NULL REFERENCES marketing_audiences(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audience_id, email)
);

ALTER TABLE marketing_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_marketing_contacts_all" ON marketing_contacts;
CREATE POLICY "sr_marketing_contacts_all" ON marketing_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS marketing_contacts_audience_id_idx ON marketing_contacts (audience_id);
CREATE INDEX IF NOT EXISTS marketing_contacts_email_idx ON marketing_contacts (email);
