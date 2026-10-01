-- 062: MartPoint Creator Network — foundation schema
-- Creator applications, AI reviews, interviews, creator accounts, levels,
-- learning centre, creator kit, challenges, submissions, metrics, referrals,
-- rewards, notifications, flags and admin notes.
--
-- Conventions (mirrors careers/partners modules):
--   * All access through the service role — tables are RLS-enabled with a
--     permissive service_role policy only.
--   * Monetary values are integer kobo (NGN minor unit).
--   * Audit events go to the shared audit_logs table (see AUDIT_ACTIONS /
--     AUDIT_ENTITIES in lib/audit.ts) — no separate creator audit table.

-- ───────────────────────────  Sequences  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_sequences (
  id INTEGER PRIMARY KEY DEFAULT 1,
  application_seq INTEGER NOT NULL DEFAULT 0,
  creator_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE creator_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_creator_sequences_all" ON creator_sequences;
CREATE POLICY "sr_creator_sequences_all" ON creator_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO creator_sequences (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Atomic increment for application reference (MCA-YYYY-XXXXX)
CREATE OR REPLACE FUNCTION increment_creator_application_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE creator_sequences
    SET application_seq = application_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING application_seq INTO next_val;
  RETURN next_val;
END;
$$;

-- Atomic increment for creator ID + referral code (MPC-XXXXX / MP-XXXXX)
CREATE OR REPLACE FUNCTION increment_creator_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE creator_sequences
    SET creator_seq = creator_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING creator_seq INTO next_val;
  RETURN next_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_creator_application_seq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_creator_seq() FROM PUBLIC, anon, authenticated;

-- ───────────────────────────  Applications  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE, -- MCA-YYYY-XXXXX

  -- Personal details
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  city TEXT,
  date_of_birth DATE,
  age_confirmed BOOLEAN NOT NULL DEFAULT false,
  profile_photo_path TEXT, -- private storage path in creator-files bucket

  -- Creator information
  primary_category TEXT NOT NULL,
  secondary_category TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  experience_years TEXT, -- e.g. "<1", "1-2", "3-5", "5+"

  -- Audience
  primary_audience TEXT,
  audience_locations TEXT[] NOT NULL DEFAULT '{}',
  audience_age_range TEXT,
  audience_has_business_owners BOOLEAN,
  audience_industries TEXT[] NOT NULL DEFAULT '{}',

  -- Portfolio: [{ url, note? }] — 2..5 entries enforced at validation layer
  portfolio_links JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Creator statement
  why_creator TEXT,
  introduce_martpoint TEXT,

  -- Consent record
  consents JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_version TEXT,
  consented_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN (
      'DRAFT','SUBMITTED','AI_REVIEWED','MANUAL_REVIEW',
      'INTERVIEW_REQUESTED','INTERVIEW_SCHEDULED',
      'APPROVED','WAITLISTED','REJECTED','SUSPENDED'
    )),
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  decision_reason TEXT,

  created_creator_id UUID, -- set on approval -> creators.id

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS creator_applications_status_idx ON creator_applications (status);
CREATE INDEX IF NOT EXISTS creator_applications_email_idx ON creator_applications (lower(email));
CREATE INDEX IF NOT EXISTS creator_applications_state_idx ON creator_applications (state);
CREATE INDEX IF NOT EXISTS creator_applications_submitted_idx ON creator_applications (submitted_at DESC);

CREATE TABLE IF NOT EXISTS creator_social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES creator_applications(id) ON DELETE CASCADE,
  creator_id UUID, -- linked to creators.id after approval (FK added below)
  platform TEXT NOT NULL
    CHECK (platform IN ('TIKTOK','INSTAGRAM','YOUTUBE','FACEBOOK','X','LINKEDIN','OTHER')),
  profile_url TEXT NOT NULL,
  username TEXT,
  followers INTEGER,
  typical_views INTEGER,
  typical_engagement TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_social_profiles_app_idx ON creator_social_profiles (application_id);
CREATE INDEX IF NOT EXISTS creator_social_profiles_creator_idx ON creator_social_profiles (creator_id);

CREATE TABLE IF NOT EXISTS creator_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES creator_applications(id) ON DELETE CASCADE,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED')),

  -- Dimension scores (see lib/creator-ai.ts for the rubric)
  score_profile_completeness NUMERIC,
  score_content_quality NUMERIC,
  score_audience_fit NUMERIC,
  score_engagement_quality NUMERIC,
  score_communication NUMERIC,
  score_geographic_value NUMERIC,
  score_brand_safety NUMERIC,
  total_score NUMERIC,

  recommendation TEXT CHECK (recommendation IN ('STRONG_CANDIDATE','REVIEW','FURTHER_VERIFICATION')),
  strengths TEXT[] NOT NULL DEFAULT '{}',
  concerns TEXT[] NOT NULL DEFAULT '{}',
  suggested_questions TEXT[] NOT NULL DEFAULT '{}',
  content_categories TEXT[] NOT NULL DEFAULT '{}',
  audience_fit_summary TEXT,
  suggested_tier TEXT,

  -- Which public data could/could not be retrieved — so reviewers know
  -- what the assessment is actually based on.
  data_notes TEXT,
  fetched_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_response JSONB,
  error_message TEXT,

  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL, -- null = automatic
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_ai_reviews_app_idx ON creator_ai_reviews (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creator_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES creator_applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  meeting_url TEXT,
  meeting_location TEXT,
  google_event_id TEXT,
  interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  interviewer_name TEXT,
  notes TEXT,
  result TEXT CHECK (result IN ('PASSED','FAILED','ON_HOLD') OR result IS NULL),
  result_notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_interviews_app_idx ON creator_interviews (application_id);

-- ───────────────────────────  Creators  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- STARTER / VERIFIED / PRO / AMBASSADOR
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Configurable advancement inputs; evaluated by lib/creators.ts.
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  benefits TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO creator_levels (name, label, description, sort_order, requirements) VALUES
  ('STARTER',    'Starter',    'New creator — onboarding and first challenge.', 0,
    '{"min_approved_content":0,"min_conversions":0}'::jsonb),
  ('VERIFIED',   'Verified',   'Consistent, guideline-compliant creator.', 1,
    '{"min_approved_content":3,"min_challenges_completed":1}'::jsonb),
  ('PRO',        'Pro',        'High-quality creator with proven results.', 2,
    '{"min_approved_content":8,"min_challenges_completed":3,"min_conversions":5}'::jsonb),
  ('AMBASSADOR', 'Ambassador', 'Top-performing regional creator and brand advocate.', 3,
    '{"min_approved_content":15,"min_challenges_completed":5,"min_conversions":20}'::jsonb)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL UNIQUE,   -- MPC-00001
  referral_code TEXT NOT NULL UNIQUE, -- MP-00001
  application_id UUID NOT NULL UNIQUE REFERENCES creator_applications(id),

  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  city TEXT,
  photo_path TEXT,
  primary_category TEXT,
  bio TEXT,

  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING_ACTIVATION','ACTIVE','SUSPENDED','REMOVED')),
  status_reason TEXT,
  level_id UUID REFERENCES creator_levels(id) ON DELETE SET NULL,

  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creators_email_idx ON creators (lower(email));
CREATE INDEX IF NOT EXISTS creators_status_idx ON creators (status);
CREATE INDEX IF NOT EXISTS creators_state_idx ON creators (state);

ALTER TABLE creator_social_profiles
  ADD CONSTRAINT creator_social_profiles_creator_fk
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;

-- One-off auth tokens (first-time password set / password reset).
CREATE TABLE IF NOT EXISTS creator_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SET_PASSWORD','RESET_PASSWORD')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_auth_tokens_creator_idx ON creator_auth_tokens (creator_id);

-- ───────────────────────────  Learning Centre  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_learning_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'ARTICLE'
    CHECK (type IN ('ARTICLE','VIDEO','GUIDE','LINK','ASSESSMENT')),
  category TEXT NOT NULL DEFAULT 'MARTPOINT_101',
  description TEXT,
  body TEXT,                 -- rich text / markdown body for articles & guides
  video_url TEXT,            -- hosted URL (YouTube/Vimeo/Signed) for VIDEO type
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  external_url TEXT,         -- LINK type target (e.g. Help Centre article)
  business_type TEXT,        -- for BUSINESS_TYPE category guides

  required BOOLEAN NOT NULL DEFAULT false,
  is_onboarding_step BOOLEAN NOT NULL DEFAULT false,
  onboarding_order INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  related_links JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{label,url}] e.g. KB articles, kit resources

  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_learning_content_cat_idx ON creator_learning_content (category, status, sort_order);

CREATE TABLE IF NOT EXISTS creator_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES creator_learning_content(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED')),
  progress_pct NUMERIC NOT NULL DEFAULT 0,
  score NUMERIC, -- assessment score where applicable
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (creator_id, content_id)
);

-- Onboarding sequence summary per creator.
CREATE TABLE IF NOT EXISTS creator_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE REFERENCES creators(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
  progress_pct NUMERIC NOT NULL DEFAULT 0,
  assessment_score NUMERIC,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────  Creator Kit  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'OTHER'
    CHECK (category IN (
      'BRAND_ASSETS','LOGOS','PRODUCT_SCREENSHOTS','PRODUCT_VIDEOS',
      'FEATURE_GUIDES','INDUSTRY_GUIDES','CONTENT_GUIDELINES',
      'CHALLENGE_BRIEFS','TEMPLATES','PRODUCT_DESCRIPTIONS','FAQ','OTHER'
    )),
  file_path TEXT,    -- private storage path (creator-files bucket)
  external_url TEXT, -- alternatively a hosted link
  version TEXT,
  published_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_resources_cat_idx ON creator_resources (category, active, sort_order);

-- ───────────────────────────  Challenges  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  objective TEXT,          -- campaign objective
  theme TEXT,

  start_date TIMESTAMPTZ,
  submission_deadline TIMESTAMPTZ,
  performance_cutoff TIMESTAMPTZ,
  announcement_date TIMESTAMPTZ,

  eligible_levels TEXT[] NOT NULL DEFAULT '{}',   -- level names; empty = all
  eligible_states TEXT[] NOT NULL DEFAULT '{}',   -- empty = nationwide
  eligible_platforms TEXT[] NOT NULL DEFAULT '{}',-- empty = all platforms
  required_hashtags TEXT[] NOT NULL DEFAULT '{}',
  required_mentions TEXT[] NOT NULL DEFAULT '{}',
  required_cta TEXT,
  content_requirements TEXT,
  prohibited_claims TEXT,
  judging_criteria TEXT,
  terms TEXT,

  featured BOOLEAN NOT NULL DEFAULT false,        -- shown on /creators landing
  leaderboard_visible BOOLEAN NOT NULL DEFAULT true,
  leaderboard_metrics JSONB NOT NULL DEFAULT '["approved_content","verified_reach","clicks","leads","conversions","points"]'::jsonb,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','SUBMISSION_CLOSED','JUDGING','COMPLETED','ARCHIVED')),

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_challenges_status_idx ON creator_challenges (status);
CREATE INDEX IF NOT EXISTS creator_challenges_featured_idx ON creator_challenges (featured) WHERE featured = true;

CREATE TABLE IF NOT EXISTS creator_challenge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  award_type TEXT NOT NULL DEFAULT 'CUSTOM'
    CHECK (award_type IN ('OVERALL','CONVERSION','REACH','CREATIVE','RISING','REGIONAL','CUSTOM')),
  title TEXT NOT NULL,
  description TEXT,
  winners_count INTEGER NOT NULL DEFAULT 1 CHECK (winners_count > 0),
  cash_amount_kobo BIGINT,
  non_cash_reward TEXT,
  judging_criteria TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_challenge_awards_ch_idx ON creator_challenge_awards (challenge_id);

CREATE TABLE IF NOT EXISTS creator_challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'JOINED' CHECK (status IN ('JOINED','WITHDRAWN','DISQUALIFIED')),
  points INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, creator_id)
);

-- ───────────────────────────  Submissions  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  platform TEXT NOT NULL
    CHECK (platform IN ('TIKTOK','INSTAGRAM','YOUTUBE','FACEBOOK','X','LINKEDIN','BLOG','OTHER')),
  content_url TEXT NOT NULL,
  caption TEXT,
  published_at TIMESTAMPTZ,
  screenshot_path TEXT,          -- private storage
  analytics_evidence_path TEXT,  -- private storage
  notes TEXT,

  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','NEEDS_CORRECTION','REJECTED','DISQUALIFIED')),
  review_feedback TEXT,     -- creator-visible feedback
  decision_reason TEXT,     -- internal reason (required for reject/disqualify)
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,

  points INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_submissions_creator_idx ON creator_submissions (creator_id);
CREATE INDEX IF NOT EXISTS creator_submissions_challenge_idx ON creator_submissions (challenge_id);
CREATE INDEX IF NOT EXISTS creator_submissions_status_idx ON creator_submissions (status);
CREATE INDEX IF NOT EXISTS creator_submissions_url_idx ON creator_submissions (content_url);

-- Metric snapshots — append-only so judging uses frozen numbers.
CREATE TABLE IF NOT EXISTS creator_submission_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES creator_submissions(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'ADMIN' CHECK (source IN ('API','ADMIN','CREATOR')),
  verified BOOLEAN NOT NULL DEFAULT false, -- API-sourced or admin-confirmed
  snapshot_label TEXT,                     -- e.g. "performance-cutoff"

  views BIGINT, likes BIGINT, comments BIGINT, shares BIGINT, saves BIGINT,
  engagement_rate NUMERIC,
  clicks BIGINT, leads BIGINT, demo_bookings BIGINT, signups BIGINT, conversions BIGINT,

  captured_by UUID, -- admin user id when source = ADMIN
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_submission_metrics_sub_idx ON creator_submission_metrics (submission_id, captured_at DESC);

-- ───────────────────────────  Referrals & Attribution  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  challenge_id UUID REFERENCES creator_challenges(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES creator_submissions(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL DEFAULT 'CLICK'
    CHECK (event_type IN ('CLICK','LEAD','DEMO','SIGNUP','CUSTOMER')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
  page_path TEXT, referrer TEXT, landing_path TEXT,
  ip TEXT, user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_referrals_creator_idx ON creator_referrals (creator_id, event_type);
CREATE INDEX IF NOT EXISTS creator_referrals_code_idx ON creator_referrals (referral_code);
CREATE INDEX IF NOT EXISTS creator_referrals_lead_idx ON creator_referrals (lead_id);
CREATE INDEX IF NOT EXISTS creator_referrals_created_idx ON creator_referrals (created_at DESC);

-- ───────────────────────────  Rewards  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('CHALLENGE_AWARD','REFERRAL_COMMISSION','MANUAL')),
  challenge_id UUID REFERENCES creator_challenges(id) ON DELETE SET NULL,
  award_id UUID REFERENCES creator_challenge_awards(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES creator_submissions(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  amount_kobo BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  non_cash_reward TEXT,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','PROCESSING','PAID','CANCELLED')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_rewards_creator_idx ON creator_rewards (creator_id, status);

-- ───────────────────────────  Notifications  ───────────────────────────

-- In-portal notification feed.
CREATE TABLE IF NOT EXISTS creator_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'GENERAL',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_notifications_creator_idx
  ON creator_notifications (creator_id, created_at DESC);

-- Outbound email delivery log (mirrors career_notification_log).
CREATE TABLE IF NOT EXISTS creator_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  application_id UUID REFERENCES creator_applications(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED','SENT','FAILED','SKIPPED')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_notification_log_app_idx ON creator_notification_log (application_id);

-- ───────────────────────────  Fraud & Admin Notes  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  application_id UUID REFERENCES creator_applications(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES creator_submissions(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN (
      'DUPLICATE_URL','DUPLICATE_SUBMISSION','REFERRAL_SPIKE','CLICK_ANOMALY',
      'SELF_REFERRAL','CONTENT_REMOVED','SUSPICIOUS_ENGAGEMENT','COPIED_CONTENT',
      'MISLEADING_CLAIM','OTHER'
    )),
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEWED','RESOLVED','DISMISSED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- null = system
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_flags_creator_idx ON creator_flags (creator_id, status);

CREATE TABLE IF NOT EXISTS creator_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES creator_applications(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES creator_submissions(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_admin_notes_app_idx ON creator_admin_notes (application_id);
CREATE INDEX IF NOT EXISTS creator_admin_notes_creator_idx ON creator_admin_notes (creator_id);

-- ───────────────────────────  Private file bucket  ───────────────────────────
-- Profile photos, kit resources and submission evidence are stored PRIVATE.
-- Authorised viewers get short-lived signed URLs; nothing is public.

INSERT INTO storage.buckets (id, name, public)
VALUES ('creator-files', 'creator-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ───────────────────────────  RLS  ───────────────────────────
-- All access goes through the service role; no direct anon/auth access.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'creator_applications','creator_social_profiles','creator_ai_reviews',
    'creator_interviews','creator_levels','creators','creator_auth_tokens',
    'creator_learning_content','creator_learning_progress','creator_onboarding',
    'creator_resources','creator_challenges','creator_challenge_awards',
    'creator_challenge_participants','creator_submissions',
    'creator_submission_metrics','creator_referrals','creator_rewards',
    'creator_notifications','creator_notification_log','creator_flags',
    'creator_admin_notes'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "sr_%I_all" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "sr_%I_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END;
$$;
