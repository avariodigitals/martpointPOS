-- Partner compliance bank details are sensitive structured data, not a file.
ALTER TABLE partner_documents
  ADD COLUMN IF NOT EXISTS submitted_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN partner_documents.submitted_fields IS
  'Structured compliance answers (including bank details). Read only by authorized server-side review flows.';

NOTIFY pgrst, 'reload schema';
