-- Creator application follow-up question rounds (mirrors partner_application_question_rounds).
-- Answers may include file uploads (screenshots/insights) stored in the private
-- creator-files bucket; responses keep the storage paths.

CREATE TABLE IF NOT EXISTS creator_application_question_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES creator_applications(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS creator_app_question_rounds_app_idx
  ON creator_application_question_rounds (application_id, created_at DESC);
ALTER TABLE creator_application_question_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_creator_application_question_rounds_all" ON creator_application_question_rounds;
CREATE POLICY "sr_creator_application_question_rounds_all" ON creator_application_question_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);
