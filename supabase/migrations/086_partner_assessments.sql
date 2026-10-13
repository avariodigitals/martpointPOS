-- ─────────────────────────────────────────────────────────────────────────────
-- Partner knowledge assessments.
--
-- Tiered, timed, fully configurable knowledge checks used in two places:
--   * APPLICANT — administered while a partner application is open, as a
--     requirement for APPROVED / APPROVED_CONDITIONAL (see
--     lib/partner-assessments.ts → evaluateApplicationAssessmentGate).
--   * PARTNER   — created and assigned to existing partners after activation.
--
-- Structure: tier → template (settings, timer, scoring bands) → questions.
-- An assignment freezes a snapshot of its template + tier, so editing a
-- template later never changes the paper an applicant is already sitting.
--
-- Grading: options/dropdown/true-false auto-mark server-side. Short/long text
-- auto-marks against configured keywords and otherwise queues for admin
-- review — correct answers are never sent to the client.
-- ─────────────────────────────────────────────────────────────────────────────

-- ───────────────────────────  Tiers  ───────────────────────────

CREATE TABLE IF NOT EXISTS partner_assessment_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  audience TEXT NOT NULL DEFAULT 'APPLICANT'
    CHECK (audience IN ('APPLICANT', 'PARTNER', 'BOTH')),
  -- When false, a cleared tier is reported on the application but does not
  -- block APPROVED.
  required_for_approval BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_assessment_tiers_level_idx
  ON partner_assessment_tiers (level);

-- ───────────────────────────  Templates  ───────────────────────────

CREATE TABLE IF NOT EXISTS partner_assessment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES partner_assessment_tiers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  time_limit_minutes INTEGER NOT NULL DEFAULT 20,
  passing_score INTEGER NOT NULL DEFAULT 70,
  conditional_score INTEGER NOT NULL DEFAULT 50,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  -- NULL = every question is used; otherwise sample that many per attempt.
  question_sample_count INTEGER,
  show_result_immediately BOOLEAN NOT NULL DEFAULT true,
  show_correct_answers BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_assessment_templates_band_check
    CHECK (conditional_score <= passing_score),
  CONSTRAINT partner_assessment_templates_score_range_check
    CHECK (passing_score BETWEEN 0 AND 100 AND conditional_score BETWEEN 0 AND 100),
  CONSTRAINT partner_assessment_templates_timer_check
    CHECK (time_limit_minutes BETWEEN 1 AND 480)
);

CREATE INDEX IF NOT EXISTS partner_assessment_templates_tier_idx
  ON partner_assessment_templates (tier_id, status);

-- ───────────────────────────  Questions  ───────────────────────────

CREATE TABLE IF NOT EXISTS partner_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES partner_assessment_templates(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('SINGLE', 'MULTI', 'TRUE_FALSE', 'DROPDOWN', 'SHORT_TEXT', 'LONG_TEXT')),
  -- [{"key":"a","text":"..."}] — TRUE_FALSE uses keys "true"/"false".
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_keys TEXT[] NOT NULL DEFAULT '{}',
  -- For SHORT_TEXT / LONG_TEXT: substrings matched case-insensitively.
  accepted_keywords TEXT[] NOT NULL DEFAULT '{}',
  keyword_mode TEXT NOT NULL DEFAULT 'ANY' CHECK (keyword_mode IN ('ANY', 'ALL')),
  points INTEGER NOT NULL DEFAULT 1,
  -- Forced true for text questions with no keywords — such answers land in the
  -- review queue rather than auto-marking as wrong.
  requires_review BOOLEAN NOT NULL DEFAULT false,
  explanation TEXT,
  help_text TEXT NOT NULL DEFAULT '',
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_assessment_questions_template_idx
  ON partner_assessment_questions (template_id, sort_order);

-- ───────────────────────────  Assignments  ───────────────────────────

CREATE TABLE IF NOT EXISTS partner_assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES partner_assessment_templates(id) ON DELETE RESTRICT,
  -- Frozen copy of the template and its tier at the moment of assignment.
  template_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  tier_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience TEXT NOT NULL CHECK (audience IN ('APPLICANT', 'PARTNER')),
  application_id UUID REFERENCES partner_applications(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  assignee_name TEXT NOT NULL DEFAULT '',
  assignee_email TEXT NOT NULL DEFAULT '',
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED', 'WAIVED', 'CANCELLED')),
  due_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  best_score NUMERIC,
  best_percent INTEGER,
  final_outcome TEXT CHECK (final_outcome IN ('PASS', 'CONDITIONAL', 'FAIL')),
  waived_reason TEXT,
  assigned_by UUID,
  assigned_by_name TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_assessment_assignments_owner_check
    CHECK (((application_id IS NOT NULL)::int + (partner_id IS NOT NULL)::int) = 1)
);

CREATE INDEX IF NOT EXISTS partner_assessment_assignments_application_idx
  ON partner_assessment_assignments (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_assessment_assignments_partner_idx
  ON partner_assessment_assignments (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_assessment_assignments_status_idx
  ON partner_assessment_assignments (status, created_at DESC);

-- ───────────────────────────  Attempts  ───────────────────────────

CREATE TABLE IF NOT EXISTS partner_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES partner_assessment_assignments(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  -- The server, not the browser, owns the deadline.
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  -- {questionId: ["a"] | "text"}
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {questionId: {awarded, max, correct, note, source}}
  grading JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC,
  max_score NUMERIC,
  percent INTEGER,
  outcome TEXT CHECK (outcome IN ('PASS', 'CONDITIONAL', 'FAIL', 'PENDING_REVIEW')),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS partner_assessment_attempts_assignment_idx
  ON partner_assessment_attempts (assignment_id, attempt_no DESC);
CREATE INDEX IF NOT EXISTS partner_assessment_attempts_review_idx
  ON partner_assessment_attempts (needs_review, created_at DESC);

-- ───────────────────────────  RLS  ───────────────────────────
-- Every table is reached only by the server via the service-role client
-- (lib/supabase.ts). Same pattern as the rest of the partner schema.

ALTER TABLE partner_assessment_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_assessment_tiers_all" ON partner_assessment_tiers;
CREATE POLICY "sr_partner_assessment_tiers_all" ON partner_assessment_tiers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE partner_assessment_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_assessment_templates_all" ON partner_assessment_templates;
CREATE POLICY "sr_partner_assessment_templates_all" ON partner_assessment_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE partner_assessment_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_assessment_questions_all" ON partner_assessment_questions;
CREATE POLICY "sr_partner_assessment_questions_all" ON partner_assessment_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE partner_assessment_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_assessment_assignments_all" ON partner_assessment_assignments;
CREATE POLICY "sr_partner_assessment_assignments_all" ON partner_assessment_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE partner_assessment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_assessment_attempts_all" ON partner_assessment_attempts;
CREATE POLICY "sr_partner_assessment_attempts_all" ON partner_assessment_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────  Seed tiers  ───────────────────────────
-- Starter tiers. Edit, reorder or deactivate freely — nothing is locked in.
-- Copy is drawn from the public partner pages (app/partners/page.tsx) so the
-- seeded questions stay factual.

INSERT INTO partner_assessment_tiers (code, name, description, level, audience, required_for_approval)
VALUES
  ('APPLICANT_T1', 'Tier 1 — Product & Partnership Foundations',
   'What an applicant should know about MartPoint and the partnership models before we approve them.',
   1, 'APPLICANT', true),
  ('APPLICANT_T2', 'Tier 2 — Commercial & Professional Conduct',
   'Commissions, agreements, brand and customer handling — the day-to-day professional basics.',
   2, 'APPLICANT', true),
  ('PARTNER_T3', 'Tier 3 — Delivery & Product Depth',
   'For active partners: deeper product knowledge, configuration and customer-facing delivery.',
   3, 'PARTNER', true)
ON CONFLICT (code) DO NOTHING;

-- ───────────────────────────  Seed starter templates  ───────────────────────────
-- DRAFT on purpose: nothing gates an approval until an admin activates a
-- template. Edit the questions before switching any template to ACTIVE.

INSERT INTO partner_assessment_templates
  (tier_id, name, description, instructions, time_limit_minutes, passing_score, conditional_score, max_attempts, status)
SELECT t.id,
  'Partner Foundations Check (starter)',
  'Sample questions covering the partnership models and how each earns. Review and edit before use.',
  'Answer every question you can. Some questions need a short written answer — write them in your own words.',
  20, 70, 50, 3, 'DRAFT'
FROM partner_assessment_tiers t WHERE t.code = 'APPLICANT_T1'
ON CONFLICT DO NOTHING;

INSERT INTO partner_assessment_questions
  (template_id, prompt, type, options, correct_keys, accepted_keywords, keyword_mode, points, requires_review, explanation, sort_order)
SELECT tpl.id, q.prompt, q.type, q.options::jsonb, q.correct_keys, q.accepted_keywords, q.keyword_mode, q.points, q.requires_review, q.explanation, q.sort_order
FROM partner_assessment_templates tpl
JOIN partner_assessment_tiers t ON t.id = tpl.tier_id AND t.code = 'APPLICANT_T1'
CROSS JOIN (VALUES
  ('A business only wants to introduce customers to MartPoint and have MartPoint handle the sale, deployment and onboarding. Which partnership model fits?',
   'SINGLE',
   '[{"key":"a","text":"Referral Partner"},{"key":"b","text":"Channel Partner"},{"key":"c","text":"Implementation Partner"},{"key":"d","text":"Technology Partner"}]'::jsonb,
   ARRAY['a']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Referral Partners introduce eligible businesses; MartPoint handles the sales process, software deployment and customer onboarding.', 0),
  ('Which partner type helps assigned customers configure business information, prepare data imports and complete training after MartPoint provisions the system?',
   'SINGLE',
   '[{"key":"a","text":"Referral Partner"},{"key":"b","text":"Channel Partner"},{"key":"c","text":"Implementation Partner"},{"key":"d","text":"Payment Partner"}]'::jsonb,
   ARRAY['c']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Implementation Partners do the configuration, data import preparation, user onboarding and training.', 1),
  ('MartPoint manages invoicing, licensing and software deployment — the partner guides the customer. Which model is this?',
   'DROPDOWN',
   '[{"key":"a","text":"Channel Partner"},{"key":"b","text":"Technology Partner"},{"key":"c","text":"Payment Partner"},{"key":"d","text":"None of these"}]'::jsonb,
   ARRAY['a']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Channel Partners help businesses choose MartPoint and give first-line usage guidance; MartPoint still does invoicing, licensing and deployment.', 2),
  ('True or false: renewal commissions are paid automatically on every renewal.',
   'TRUE_FALSE',
   '[{"key":"true","text":"True"},{"key":"false","text":"False"}]'::jsonb,
   ARRAY['false']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Renewal commissions are not automatic. Where they are offered, the eligible period and rate are stated in the partner agreement.', 3),
  ('Which partner type works with MartPoint to enable approved payment services?',
   'SHORT_TEXT',
   '[]'::jsonb,
   ARRAY[]::text[], ARRAY['payment']::text[], 'ANY', 1, false,
   'Payment Partners enable approved payment services under a reviewed technical and commercial arrangement.', 4),
  ('In your own words, describe what a Channel Partner does for an assigned customer. Mention onboarding or usage guidance if you can.',
   'LONG_TEXT',
   '[]'::jsonb,
   ARRAY[]::text[], ARRAY['onboarding', 'guidance', 'training', 'usage']::text[], 'ANY', 2, false,
   'A Channel Partner helps the customer choose MartPoint, coordinates onboarding and gives agreed first-line usage guidance.', 5)
) AS q(prompt, type, options, correct_keys, accepted_keywords, keyword_mode, points, requires_review, explanation, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO partner_assessment_templates
  (tier_id, name, description, instructions, time_limit_minutes, passing_score, conditional_score, max_attempts, status)
SELECT t.id,
  'Commercial & Conduct Check (starter)',
  'Sample questions on commissions, agreements and what approval does and does not grant.',
  'Answer every question. Short written answers should be in your own words.',
  15, 75, 55, 2, 'DRAFT'
FROM partner_assessment_tiers t WHERE t.code = 'APPLICANT_T2'
ON CONFLICT DO NOTHING;

INSERT INTO partner_assessment_questions
  (template_id, prompt, type, options, correct_keys, accepted_keywords, keyword_mode, points, requires_review, explanation, sort_order)
SELECT tpl.id, q.prompt, q.type, q.options::jsonb, q.correct_keys, q.accepted_keywords, q.keyword_mode, q.points, q.requires_review, q.explanation, q.sort_order
FROM partner_assessment_templates tpl
JOIN partner_assessment_tiers t ON t.id = tpl.tier_id AND t.code = 'APPLICANT_T2'
CROSS JOIN (VALUES
  ('True or false: becoming an approved partner automatically grants discounted software licenses.',
   'TRUE_FALSE',
   '[{"key":"true","text":"True"},{"key":"false","text":"False"}]'::jsonb,
   ARRAY['false']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Partner approval does not automatically provide discounted licences.', 0),
  ('Eligible commissions are calculated monthly and paid within how many days after the relevant month-end?',
   'SINGLE',
   '[{"key":"a","text":"7 days"},{"key":"b","text":"14 days"},{"key":"c","text":"30 days"},{"key":"d","text":"At our own discretion"}]'::jsonb,
   ARRAY['b']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Eligible commissions are calculated monthly and paid within 14 days after the relevant month-end, subject to the partner agreement.', 1),
  ('A prospect asks you to quote a price that is not in the current published price list. What should you do?',
   'MULTI',
   '[{"key":"a","text":"Quote it from memory so the prospect is not kept waiting"},{"key":"b","text":"Check the current approved pricing with the MartPoint team first"},{"key":"c","text":"Say pricing is confirmed only once agreed by MartPoint"},{"key":"d","text":"Offer a personal discount to close the deal"}]'::jsonb,
   ARRAY['b','c']::text[], ARRAY[]::text[], 'ANY', 1, false,
   'Only approved, current pricing should be quoted. Anything outside the published list needs MartPoint confirmation.', 2),
  ('Why is it important to use only approved product and sales information when speaking to customers?',
   'SHORT_TEXT',
   '[]'::jsonb,
   ARRAY[]::text[], ARRAY['accuracy', 'accurate', 'approved', 'mislead', 'correct']::text[], 'ANY', 1, false,
   'Using approved information keeps what partners say about MartPoint accurate and consistent.', 3),
  ('Describe how you would handle a customer complaint about a MartPoint feature you did not personally build or configure.',
   'LONG_TEXT',
   '[]'::jsonb,
   ARRAY[]::text[], ARRAY['listen', 'escalate', 'support', 'martpoint', 'ticket']::text[], 'ANY', 2, false,
   'Listen, capture the detail, and escalate through MartPoint support rather than making commitments on our behalf.', 4)
) AS q(prompt, type, options, correct_keys, accepted_keywords, keyword_mode, points, requires_review, explanation, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO partner_assessment_templates
  (tier_id, name, description, instructions, time_limit_minutes, passing_score, conditional_score, max_attempts, status)
SELECT t.id,
  'Delivery & Product Depth (starter)',
  'Placeholder template for active partners. Add your own questions before activating.',
  'Answer every question you can.',
  30, 75, 60, 2, 'DRAFT'
FROM partner_assessment_tiers t WHERE t.code = 'PARTNER_T3'
ON CONFLICT DO NOTHING;
