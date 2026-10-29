-- Direct partner correspondence, separate from compliance and document requests.
CREATE TABLE IF NOT EXISTS partner_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','failed','received')),
  provider TEXT,
  provider_message_id TEXT,
  client_request_id UUID,
  request_hash TEXT,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_emails_history_idx ON partner_emails(partner_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS partner_emails_request_idx ON partner_emails(partner_id,client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partner_emails_provider_idx ON partner_emails(partner_id,provider_message_id)
  WHERE provider_message_id IS NOT NULL;
ALTER TABLE partner_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_emails FROM PUBLIC,anon,authenticated;
GRANT ALL ON partner_emails TO service_role;
DROP POLICY IF EXISTS sr_partner_emails ON partner_emails;
CREATE POLICY sr_partner_emails ON partner_emails FOR ALL TO service_role USING(true) WITH CHECK(true);
COMMENT ON TABLE partner_emails IS 'Private partner correspondence. Accepted means the email provider accepted the message, not proof of delivery.';
NOTIFY pgrst,'reload schema';
