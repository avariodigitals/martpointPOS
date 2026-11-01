-- Named batches for dedicated SMS, email and WhatsApp campaign workspaces.
CREATE TABLE IF NOT EXISTS communication_campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms','whatsapp')),
  audience_label TEXT NOT NULL DEFAULT '',
  recipient_count INT NOT NULL DEFAULT 0 CHECK(recipient_count >= 0),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE communication_messages
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES communication_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS communication_campaigns_channel_created_idx
  ON communication_campaigns(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS communication_messages_campaign_idx
  ON communication_messages(campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;

ALTER TABLE communication_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON communication_campaigns FROM PUBLIC,anon,authenticated;
GRANT ALL ON communication_campaigns TO service_role;
DROP POLICY IF EXISTS sr_communications ON communication_campaigns;
CREATE POLICY sr_communications ON communication_campaigns FOR ALL TO service_role USING(true) WITH CHECK(true);

NOTIFY pgrst,'reload schema';
