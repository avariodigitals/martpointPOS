-- Ordinary admin-to-creator email conversations are separate from question rounds.
CREATE TABLE IF NOT EXISTS creator_application_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES creator_applications(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT,
  to_email TEXT,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'received')),
  provider TEXT,
  provider_message_id TEXT,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_application_emails_message_dedupe_idx
  ON creator_application_emails(application_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creator_application_emails_thread_idx
  ON creator_application_emails(application_id, created_at DESC);

ALTER TABLE creator_application_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON creator_application_emails FROM anon, authenticated;
GRANT ALL ON creator_application_emails TO service_role;
DROP POLICY IF EXISTS sr_creator_application_emails ON creator_application_emails;
CREATE POLICY sr_creator_application_emails ON creator_application_emails
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE creator_application_emails IS
  'Ordinary email conversations with creator applicants. Kept distinct from structured additional-question rounds.';

NOTIFY pgrst, 'reload schema';
