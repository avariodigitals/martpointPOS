-- Email marketing: campaigns, per-recipient sends (open/click tracking),
-- and the unsubscribe suppression list. Idempotent and additive.

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'manual',
  provider TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','partial','failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_marketing_campaigns_all" ON marketing_campaigns;
CREATE POLICY "sr_marketing_campaigns_all" ON marketing_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS marketing_campaigns_created_at_idx ON marketing_campaigns (created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_marketing_sends_all" ON marketing_sends;
CREATE POLICY "sr_marketing_sends_all" ON marketing_sends FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS marketing_sends_campaign_id_idx ON marketing_sends (campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_sends_token_idx ON marketing_sends (token);
CREATE INDEX IF NOT EXISTS marketing_sends_email_idx ON marketing_sends (email);

-- Suppression list: any email here must never receive marketing sends.
CREATE TABLE IF NOT EXISTS marketing_unsubscribes (
  email TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_unsubscribes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_marketing_unsubscribes_all" ON marketing_unsubscribes;
CREATE POLICY "sr_marketing_unsubscribes_all" ON marketing_unsubscribes FOR ALL TO service_role USING (true) WITH CHECK (true);
