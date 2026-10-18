-- Career application AI-assisted review (mirrors partner_ai_reviews from 093).
-- AI produces a score + assessment note + recommendation only; it never
-- changes the application status. Mode (AUTO vs MANUAL) lives in
-- career_settings under key 'ai_assessment' as {"mode": "AUTO"|"MANUAL"}.
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS career_application_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES career_applications(id) ON DELETE CASCADE,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED')),

  -- Dimension scores (see lib/careers-ai.ts for the rubric)
  score_role_fit NUMERIC,
  score_experience NUMERIC,
  score_skills NUMERIC,
  score_logistics NUMERIC,
  score_communication NUMERIC,
  total_score NUMERIC,

  recommendation TEXT CHECK (recommendation IN ('SHORTLIST','REVIEW','DO_NOT_PROGRESS')),
  summary TEXT,
  strengths TEXT[] NOT NULL DEFAULT '{}',
  concerns TEXT[] NOT NULL DEFAULT '{}',
  suggested_questions TEXT[] NOT NULL DEFAULT '{}',

  data_notes TEXT,
  raw_response JSONB,
  error_message TEXT,

  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL, -- null = automatic
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_application_ai_reviews_app_idx
  ON career_application_ai_reviews (application_id, created_at DESC);

ALTER TABLE career_application_ai_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_career_ai_reviews_all" ON career_application_ai_reviews;
CREATE POLICY "sr_career_ai_reviews_all" ON career_application_ai_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
