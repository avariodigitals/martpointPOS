-- Private staff drafts for manual lead, partner and creator correspondence.
CREATE TABLE IF NOT EXISTS email_composer_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('leads','partners','creators')),
  entity_id UUID NOT NULL,
  draft JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);
ALTER TABLE email_composer_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_composer_drafts FROM PUBLIC, anon, authenticated;
GRANT ALL ON email_composer_drafts TO service_role;
DROP POLICY IF EXISTS sr_email_composer_drafts ON email_composer_drafts;
CREATE POLICY sr_email_composer_drafts ON email_composer_drafts
  FOR ALL TO service_role USING(true) WITH CHECK(true);
COMMENT ON TABLE email_composer_drafts IS 'Private per-staff composer drafts, including selected attachment bytes. Drafts are never sent automatically.';
NOTIFY pgrst, 'reload schema';
