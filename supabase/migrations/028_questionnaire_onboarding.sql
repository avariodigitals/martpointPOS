-- Lead questionnaire + onboarding kanban metadata

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEAD QUESTIONNAIRE
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS questionnaire_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS questionnaire_status TEXT NOT NULL DEFAULT 'Not Sent'
    CHECK (questionnaire_status IN ('Not Sent','Sent','In Progress','Submitted','Reviewed')),
  ADD COLUMN IF NOT EXISTS questionnaire_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS questionnaire_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS questionnaire_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS questionnaire_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_questionnaire_token_idx ON leads (questionnaire_token);
CREATE INDEX IF NOT EXISTS leads_questionnaire_status_idx ON leads (questionnaire_status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ONBOARDING KANBAN METADATA
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_owner TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_health TEXT NOT NULL DEFAULT 'On Track'
    CHECK (onboarding_health IN ('On Track','At Risk','Blocked')),
  ADD COLUMN IF NOT EXISTS onboarding_waiting_on TEXT NOT NULL DEFAULT 'None'
    CHECK (onboarding_waiting_on IN ('None','Customer','MartPoint','Partner')),
  ADD COLUMN IF NOT EXISTS blocker_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocker_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_go_live DATE,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_progress INTEGER NOT NULL DEFAULT 0
    CHECK (onboarding_progress BETWEEN 0 AND 100);

-- The existing onboarding_stages JSONB will hold kanban stage progress.

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRAINING SESSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS onboarding_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL DEFAULT 1,
  training_date TIMESTAMPTZ,
  mode TEXT CHECK (mode IN ('Remote','Onsite')),
  trainer TEXT,
  attendees TEXT,
  notes TEXT,
  modules_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_training_business_idx ON onboarding_training_sessions (business_id);

ALTER TABLE onboarding_training_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_onboarding_training_sessions_all" ON onboarding_training_sessions;
CREATE POLICY "sr_onboarding_training_sessions_all" ON onboarding_training_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Backfill onboarding start time for businesses already in onboarding.
UPDATE businesses
SET onboarding_started_at = created_at
WHERE status = 'ONBOARDING' AND onboarding_started_at IS NULL;
