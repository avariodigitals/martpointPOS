-- Partner application AI-assisted review (mirrors creator_ai_reviews from 062).
-- AI produces a recommendation + reasoning only; it never decides the outcome.
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS partner_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED')),

  -- Dimension scores (see lib/partner-ai.ts for the rubric)
  score_completeness NUMERIC,
  score_capability NUMERIC,
  score_partner_type_fit NUMERIC,
  score_market_reach NUMERIC,
  score_communication NUMERIC,
  score_trust_risk NUMERIC,
  total_score NUMERIC,

  recommendation TEXT CHECK (recommendation IN ('STRONG_CANDIDATE','REVIEW','FURTHER_VERIFICATION')),
  strengths TEXT[] NOT NULL DEFAULT '{}',
  concerns TEXT[] NOT NULL DEFAULT '{}',
  suggested_questions TEXT[] NOT NULL DEFAULT '{}',
  suggested_partner_type TEXT,
  industry_fit_summary TEXT,

  -- Which public sites could/could not be retrieved — so reviewers know
  -- what the assessment is actually based on.
  data_notes TEXT,
  fetched_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_response JSONB,
  error_message TEXT,

  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL, -- null = automatic
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_ai_reviews_app_idx ON partner_ai_reviews (application_id, created_at DESC);

ALTER TABLE partner_ai_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_ai_reviews_all" ON partner_ai_reviews;
CREATE POLICY "sr_partner_ai_reviews_all" ON partner_ai_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
