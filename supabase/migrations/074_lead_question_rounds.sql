-- Additional lead questions — short follow-up rounds after the main questionnaire.
-- The lead answers the original requirements questionnaire once. Sales can then send
-- small, separate follow-up rounds (each with its own token + public link) without
-- asking the lead to redo the long form. Every round keeps its own questions and
-- answers so the full history stays available for documentation on the lead.

CREATE TABLE IF NOT EXISTS lead_question_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Additional Questions',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'Sent'
    CHECK (status IN ('Sent','Submitted','Reviewed')),
  sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_question_rounds_lead_idx
  ON lead_question_rounds (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_question_rounds_token_idx
  ON lead_question_rounds (token);

ALTER TABLE lead_question_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_lead_question_rounds_all" ON lead_question_rounds;
CREATE POLICY "sr_lead_question_rounds_all" ON lead_question_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);
