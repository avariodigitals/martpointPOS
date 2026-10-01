-- ─────────────────────────────────────────────────────────────────────────────
-- Creator Network Phase 2 — Learning Centre, Assessment, Guides, FAQ, KB links.
-- Extends the Phase 1 schema (062). All new tables follow the same RLS pattern:
-- enabled + permissive service_role-only policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- Learning content: publish date, audience targeting + assessment config.
ALTER TABLE creator_learning_content
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT '{}',
  -- For type='ASSESSMENT': {"passingScore":70,"maxAttempts":3,"showIncorrect":true}
  ADD COLUMN IF NOT EXISTS assessment_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add DOWNLOAD to the allowed content types.
ALTER TABLE creator_learning_content
  DROP CONSTRAINT IF EXISTS creator_learning_content_type_check;
ALTER TABLE creator_learning_content
  ADD CONSTRAINT creator_learning_content_type_check
  CHECK (type IN ('ARTICLE','VIDEO','GUIDE','LINK','DOWNLOAD','ASSESSMENT'));

-- Keep published_at roughly in sync for existing published rows.
UPDATE creator_learning_content SET published_at = COALESCE(published_at, created_at)
WHERE status = 'PUBLISHED' AND published_at IS NULL;

-- ───────────────────────────  Assessments  ───────────────────────────

CREATE TABLE IF NOT EXISTS creator_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES creator_learning_content(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SINGLE' CHECK (type IN ('SINGLE','TRUE_FALSE','MULTI')),
  -- options: [{"key":"a","text":"..."}] — for TRUE_FALSE use keys "true"/"false"
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_keys TEXT[] NOT NULL DEFAULT '{}',
  feedback TEXT,          -- shown after submission when configured
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_assessment_questions_content_idx
  ON creator_assessment_questions (content_id, sort_order);

CREATE TABLE IF NOT EXISTS creator_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES creator_learning_content(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  score NUMERIC,              -- 0-100
  passed BOOLEAN,
  -- {questionId: ["a","c"]}
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS creator_assessment_attempts_creator_idx
  ON creator_assessment_attempts (creator_id, content_id, attempt_no);

-- ───────────────────────────  Business-type Creator Guides  ───────────────────────────
-- industry_slug references lib/industries.ts slugs — the app's canonical
-- business-type registry. No second hard-coded industry list in the DB.

CREATE TABLE IF NOT EXISTS creator_business_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  overview TEXT,                 -- what this business type does
  common_problems TEXT[] NOT NULL DEFAULT '{}',
  how_helps TEXT,                -- plain-language "how MartPoint helps"
  features TEXT[] NOT NULL DEFAULT '{}',
  content_angles TEXT[] NOT NULL DEFAULT '{}',
  hooks TEXT[] NOT NULL DEFAULT '{}',
  use_cases TEXT[] NOT NULL DEFAULT '{}',
  claims_to_avoid TEXT[] NOT NULL DEFAULT '{}',
  recommended_cta TEXT,
  -- [{label,url}] KB articles, lessons, resources
  related_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_business_guides_status_idx
  ON creator_business_guides (status, sort_order);

-- ───────────────────────────  Creator FAQ  ───────────────────────────
-- Separate from the public website `faqs` table — creator-facing only.

CREATE TABLE IF NOT EXISTS creator_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_faqs_status_idx ON creator_faqs (status, category, sort_order);

-- ───────────────────────────  Curated KB links  ───────────────────────────
-- The public KB (/help-centre) is static content; admins curate deep links to
-- public help topics here so lessons/guides can surface contextual KB pointers
-- without hard-coding them.

CREATE TABLE IF NOT EXISTS creator_kb_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,           -- typically /help-centre or an anchored section
  category TEXT NOT NULL DEFAULT 'GENERAL',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────  Creator Kit resource extensions  ───────────────────────────

ALTER TABLE creator_resources
  DROP CONSTRAINT IF EXISTS creator_resources_category_check;
ALTER TABLE creator_resources
  ADD CONSTRAINT creator_resources_category_check
  CHECK (category IN (
    'GETTING_STARTED','BRAND_ASSETS','LOGOS','PRODUCT_SCREENSHOTS','PRODUCT_VIDEOS',
    'FEATURE_GUIDES','INDUSTRY_GUIDES','BUSINESS_TYPE_GUIDES','CONTENT_GUIDELINES',
    'CONTENT_PLAYBOOK','CHALLENGE_BRIEFS','CHALLENGE_RESOURCES','TEMPLATES',
    'PRODUCT_DESCRIPTIONS','FAQ','OTHER'
  ));

ALTER TABLE creator_resources
  ADD COLUMN IF NOT EXISTS resource_type TEXT NOT NULL DEFAULT 'FILE'
    CHECK (resource_type IN ('FILE','IMAGE','VIDEO','ARTICLE','LINK')),
  ADD COLUMN IF NOT EXISTS usage_notes TEXT,
  ADD COLUMN IF NOT EXISTS preview_path TEXT; -- optional thumbnail in creator-files bucket

-- ───────────────────────────  Creator activity events  ───────────────────────────
-- Lightweight analytics for learning/kit/KB interactions.

CREATE TABLE IF NOT EXISTS creator_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,    -- LEARNING_STARTED, LESSON_COMPLETED, VIDEO_COMPLETED,
                               -- RESOURCE_VIEWED, RESOURCE_DOWNLOADED, KB_LINK_OPENED,
                               -- ASSESSMENT_STARTED, ASSESSMENT_COMPLETED,
                               -- ASSESSMENT_PASSED, ONBOARDING_COMPLETED
  entity_type TEXT,            -- learning_content | resource | kb_link | assessment
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_activity_creator_idx
  ON creator_activity_events (creator_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_activity_type_idx
  ON creator_activity_events (event_type, created_at DESC);

-- ───────────────────────────  Onboarding readiness  ───────────────────────────

ALTER TABLE creator_onboarding
  ADD COLUMN IF NOT EXISTS assessment_passed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- ───────────────────────────  RLS  ───────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'creator_assessment_questions','creator_assessment_attempts',
    'creator_business_guides','creator_faqs','creator_kb_links',
    'creator_activity_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "sr_%I_all" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "sr_%I_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;
