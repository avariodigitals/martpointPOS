-- Careers, Recruitment & Field Workforce Management
-- Vacancies, vacancy-specific application forms, application pipeline,
-- talent pool, assessments and field-worker deployments.
--
-- Money convention: all monetary values are stored as integer kobo (NGN minor
-- unit) unless a different currency is set on the row — consistent with
-- finance_transactions/finance-ledger conventions (toKobo/fromKobo).

-- ───────────────────────────  Lookups  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS career_job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────  Vacancies  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  reference_number TEXT NOT NULL UNIQUE,

  department_id UUID REFERENCES career_departments(id) ON DELETE SET NULL,
  job_category_id UUID REFERENCES career_job_categories(id) ON DELETE SET NULL,

  short_summary TEXT,
  description TEXT,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  requirements TEXT[] NOT NULL DEFAULT '{}',

  openings INTEGER NOT NULL DEFAULT 1 CHECK (openings > 0),
  show_openings BOOLEAN NOT NULL DEFAULT true,
  hiring_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  urgent BOOLEAN NOT NULL DEFAULT false,

  employment_type TEXT NOT NULL DEFAULT 'PERMANENT'
    CHECK (employment_type IN ('PERMANENT','CONTRACT','TEMPORARY','INTERNSHIP','PROJECT_BASED','ON_CALL_FIELD')),
  work_arrangement TEXT NOT NULL DEFAULT 'ON_SITE'
    CHECK (work_arrangement IN ('ON_SITE','REMOTE','HYBRID','FIELD_BASED')),
  working_days TEXT,
  work_start_time TEXT,
  work_end_time TEXT,
  project_start_date DATE,
  project_end_date DATE,
  duration_description TEXT,

  compensation_type TEXT NOT NULL DEFAULT 'NEGOTIABLE'
    CHECK (compensation_type IN ('DAILY','WEEKLY','MONTHLY','PROJECT_FEE','NEGOTIABLE')),
  compensation_min_kobo BIGINT,
  compensation_max_kobo BIGINT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  show_compensation BOOLEAN NOT NULL DEFAULT false,
  transport_allowance_kobo BIGINT,
  lunch_provided BOOLEAN NOT NULL DEFAULT false,
  accommodation_provided BOOLEAN NOT NULL DEFAULT false,
  other_benefits TEXT,

  application_opens_at TIMESTAMPTZ,
  application_closes_at TIMESTAMPTZ,
  max_applications INTEGER,
  cv_required BOOLEAN NOT NULL DEFAULT true,
  cover_letter_required BOOLEAN NOT NULL DEFAULT false,
  portfolio_enabled BOOLEAN NOT NULL DEFAULT false,
  pass_score NUMERIC,
  confirmation_message TEXT,
  auto_close_on_deadline BOOLEAN NOT NULL DEFAULT true,
  auto_close_on_max_applications BOOLEAN NOT NULL DEFAULT false,
  -- Per-vacancy toggle for equipment/mobility questions on the apply form.
  equipment_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SCHEDULED','PUBLISHED','PAUSED','CLOSED','ARCHIVED')),
  scheduled_publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  archived_at TIMESTAMPTZ,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS career_vacancies_status_idx ON career_vacancies (status);
CREATE INDEX IF NOT EXISTS career_vacancies_slug_idx ON career_vacancies (slug);
CREATE INDEX IF NOT EXISTS career_vacancies_publish_window_idx
  ON career_vacancies (application_opens_at, application_closes_at)
  WHERE status IN ('PUBLISHED','SCHEDULED');
CREATE INDEX IF NOT EXISTS career_vacancies_featured_idx ON career_vacancies (featured) WHERE featured = true;

-- Multiple locations per vacancy; public fields are exposed on the website,
-- full_address is internal only.
CREATE TABLE IF NOT EXISTS career_vacancy_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID NOT NULL REFERENCES career_vacancies(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  lga TEXT,
  city TEXT,
  area_site TEXT,
  full_address TEXT,
  public_description TEXT,
  nearby_preferred BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_vacancy_locations_vacancy_idx ON career_vacancy_locations (vacancy_id);
CREATE INDEX IF NOT EXISTS career_vacancy_locations_state_idx ON career_vacancy_locations (state);
CREATE INDEX IF NOT EXISTS career_vacancy_locations_city_idx ON career_vacancy_locations (city);

-- ───────────────────────────  Screening questions  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_screening_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID NOT NULL REFERENCES career_vacancies(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'SHORT_TEXT'
    CHECK (answer_type IN ('YES_NO','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','NUMBER','DATE','FILE','RATING','LOCATION')),
  required BOOLEAN NOT NULL DEFAULT true,
  knockout BOOLEAN NOT NULL DEFAULT false,
  correct_answer TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_screening_questions_vacancy_idx ON career_screening_questions (vacancy_id, sort_order);

CREATE TABLE IF NOT EXISTS career_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES career_screening_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_question_options_question_idx ON career_question_options (question_id, sort_order);

-- ───────────────────────────  Applications  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  vacancy_id UUID NOT NULL REFERENCES career_vacancies(id) ON DELETE RESTRICT,

  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,

  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  lga TEXT,
  city TEXT,
  residential_area TEXT,

  employment_status TEXT,
  earliest_available_date DATE,
  available_working_hours BOOLEAN,
  available_full_duration BOOLEAN,
  can_travel_to_location BOOLEAN,
  requires_accommodation BOOLEAN,
  other_work_cities TEXT,

  highest_qualification TEXT,
  field_of_study TEXT,
  current_occupation TEXT,
  years_experience NUMERIC,
  work_history TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  excel_proficiency TEXT,
  inventory_software_experience TEXT,

  owns_android BOOLEAN,
  smartphone_model TEXT,
  has_mobile_data BOOLEAN,
  owns_laptop BOOLEAN,
  owns_power_bank BOOLEAN,
  transportation TEXT,

  linkedin_url TEXT,
  portfolio_url TEXT,

  status TEXT NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW','SCREENING_PASSED','SCREENING_FAILED','UNDER_REVIEW','SHORTLISTED','ASSESSMENT_INVITED','ASSESSMENT_COMPLETED','VERIFIED','SELECTED','RESERVE','DEPLOYED','COMPLETED','REJECTED','WITHDRAWN','BLACKLISTED')),
  screening_score NUMERIC,
  screening_passed BOOLEAN,
  review_score NUMERIC,
  assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,

  consent_accuracy BOOLEAN NOT NULL DEFAULT false,
  consent_privacy BOOLEAN NOT NULL DEFAULT false,
  consent_talent_pool BOOLEAN NOT NULL DEFAULT false,
  consent_notifications BOOLEAN NOT NULL DEFAULT false,
  privacy_version TEXT,
  consent_at TIMESTAMPTZ,

  source TEXT NOT NULL DEFAULT 'careers_page',
  duplicate_of UUID REFERENCES career_applications(id) ON DELETE SET NULL,
  candidate_profile_id UUID,
  ip_address TEXT,
  user_agent TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_applications_vacancy_idx ON career_applications (vacancy_id, status);
CREATE INDEX IF NOT EXISTS career_applications_status_idx ON career_applications (status);
CREATE INDEX IF NOT EXISTS career_applications_email_idx ON career_applications (lower(email));
CREATE INDEX IF NOT EXISTS career_applications_reference_idx ON career_applications (reference_number);
CREATE INDEX IF NOT EXISTS career_applications_state_idx ON career_applications (state);
CREATE INDEX IF NOT EXISTS career_applications_submitted_idx ON career_applications (submitted_at DESC);

-- One active application per vacancy per email (re-application allowed after
-- REJECTED / WITHDRAWN / BLACKLISTED outcomes).
CREATE UNIQUE INDEX IF NOT EXISTS career_applications_active_unique
  ON career_applications (vacancy_id, lower(email))
  WHERE status NOT IN ('REJECTED','WITHDRAWN','BLACKLISTED');

CREATE TABLE IF NOT EXISTS career_application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES career_applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES career_screening_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_json JSONB,
  file_document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, question_id)
);

CREATE INDEX IF NOT EXISTS career_application_answers_app_idx ON career_application_answers (application_id);

CREATE TABLE IF NOT EXISTS career_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES career_applications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'CV'
    CHECK (kind IN ('CV','COVER_LETTER','PORTFOLIO','ANSWER_FILE','OTHER')),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_application_documents_app_idx ON career_application_documents (application_id);

ALTER TABLE career_application_answers
  ADD CONSTRAINT career_application_answers_doc_fk
  FOREIGN KEY (file_document_id) REFERENCES career_application_documents(id) ON DELETE SET NULL;

-- Immutable status history — insert-only by convention.
CREATE TABLE IF NOT EXISTS career_application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES career_applications(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_app_status_history_app_idx ON career_application_status_history (application_id, created_at);

CREATE TABLE IF NOT EXISTS career_application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES career_applications(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_application_notes_app_idx ON career_application_notes (application_id, created_at);

-- ───────────────────────────  Talent pool (candidate profiles)  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,

  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  lga TEXT,
  city TEXT,
  residential_area TEXT,

  qualified_roles TEXT[] NOT NULL DEFAULT '{}',
  employment_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  availability_notes TEXT,
  earliest_available_date DATE,
  other_work_cities TEXT,

  highest_qualification TEXT,
  field_of_study TEXT,
  years_experience NUMERIC,
  equipment JSONB NOT NULL DEFAULT '{}'::jsonb,

  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
  performance_rating NUMERIC,
  accuracy_rating NUMERIC,
  team_lead_eligible BOOLEAN NOT NULL DEFAULT false,
  supervisor_comments TEXT,

  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  last_contacted_at TIMESTAMPTZ,

  consent_talent_pool BOOLEAN NOT NULL DEFAULT false,
  consent_notifications BOOLEAN NOT NULL DEFAULT false,
  privacy_version TEXT,
  consent_at TIMESTAMPTZ,

  source TEXT NOT NULL DEFAULT 'talent_pool_form',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS career_candidate_profiles_email_idx
  ON career_candidate_profiles (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS career_candidate_profiles_state_idx ON career_candidate_profiles (state, city);
CREATE INDEX IF NOT EXISTS career_candidate_profiles_status_idx ON career_candidate_profiles (status, verification_status);
CREATE INDEX IF NOT EXISTS career_candidate_profiles_teamlead_idx ON career_candidate_profiles (team_lead_eligible) WHERE team_lead_eligible = true;

ALTER TABLE career_applications
  ADD CONSTRAINT career_applications_candidate_fk
  FOREIGN KEY (candidate_profile_id) REFERENCES career_candidate_profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS career_candidate_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES career_candidate_profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, skill)
);

CREATE INDEX IF NOT EXISTS career_candidate_skills_skill_idx ON career_candidate_skills (skill);

CREATE TABLE IF NOT EXISTS career_candidate_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES career_candidate_profiles(id) ON DELETE CASCADE,
  available_from DATE,
  available_to DATE,
  days TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_candidate_availability_idx ON career_candidate_availability (candidate_id);

-- ───────────────────────────  Assessments  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID REFERENCES career_vacancies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'PRACTICAL'
    CHECK (assessment_type IN ('WRITTEN','PRACTICAL','PRODUCT_CAPTURE','INTERVIEW','OTHER')),
  instructions TEXT,
  max_score NUMERIC NOT NULL DEFAULT 100,
  pass_score NUMERIC,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','INVITED','IN_PROGRESS','COMPLETED','CANCELLED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_assessments_vacancy_idx ON career_assessments (vacancy_id);

CREATE TABLE IF NOT EXISTS career_assessment_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES career_assessments(id) ON DELETE CASCADE,
  application_id UUID REFERENCES career_applications(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES career_candidate_profiles(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score NUMERIC,
  passed BOOLEAN,
  evaluator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  evaluator_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (application_id IS NOT NULL OR candidate_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS career_assessment_candidates_unique
  ON career_assessment_candidates (assessment_id, application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS career_assessment_candidates_assessment_idx ON career_assessment_candidates (assessment_id);

-- ───────────────────────────  Deployments  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  project_client TEXT,
  vacancy_id UUID REFERENCES career_vacancies(id) ON DELETE SET NULL,

  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  lga TEXT,
  city TEXT,
  site_address TEXT,

  start_date DATE,
  end_date DATE,
  team_lead_candidate_id UUID REFERENCES career_candidate_profiles(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','ACTIVE','COMPLETED','CANCELLED')),
  daily_rate_kobo BIGINT,
  transport_allowance_kobo BIGINT,
  feeding_arrangement TEXT,
  expected_daily_target INTEGER,
  notes TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_deployments_status_idx ON career_deployments (status);
CREATE INDEX IF NOT EXISTS career_deployments_location_idx ON career_deployments (state, city);

CREATE TABLE IF NOT EXISTS career_deployment_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES career_deployments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES career_candidate_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES career_applications(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'WORKER' CHECK (role IN ('WORKER','TEAM_LEAD')),
  daily_rate_kobo BIGINT,
  status TEXT NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED','INVITED','CONFIRMED','ACTIVE','COMPLETED','REMOVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deployment_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS career_deployment_workers_deployment_idx ON career_deployment_workers (deployment_id);
CREATE INDEX IF NOT EXISTS career_deployment_workers_candidate_idx ON career_deployment_workers (candidate_id);

CREATE TABLE IF NOT EXISTS career_deployment_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES career_deployments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES career_candidate_profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PRESENT'
    CHECK (status IN ('PRESENT','ABSENT','LATE','HALF_DAY','EXCUSED')),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deployment_id, candidate_id, work_date)
);

CREATE INDEX IF NOT EXISTS career_deployment_attendance_idx ON career_deployment_attendance (deployment_id, work_date);

CREATE TABLE IF NOT EXISTS career_deployment_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES career_deployments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES career_candidate_profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  products_captured INTEGER NOT NULL DEFAULT 0,
  verified_products INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  supervisor_rating NUMERIC,
  quality_notes TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deployment_id, candidate_id, work_date)
);

CREATE INDEX IF NOT EXISTS career_deployment_performance_idx ON career_deployment_performance (deployment_id, work_date);
CREATE INDEX IF NOT EXISTS career_deployment_performance_candidate_idx ON career_deployment_performance (candidate_id);

-- ───────────────────────────  Notifications / settings  ───────────────────────────

-- Delivery status for careers notifications (email now; channel column leaves
-- room for a WhatsApp provider later without schema changes).
CREATE TABLE IF NOT EXISTS career_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES career_applications(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES career_candidate_profiles(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL','WHATSAPP')),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','FAILED','SKIPPED')),
  provider_response TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_notification_log_app_idx ON career_notification_log (application_id);
CREATE INDEX IF NOT EXISTS career_notification_log_status_idx ON career_notification_log (status);

CREATE TABLE IF NOT EXISTS career_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────  Private document bucket  ───────────────────────────
-- CVs and applicant documents are stored PRIVATE. Admins view them through
-- short-lived signed URLs; no public URL is ever exposed.

INSERT INTO storage.buckets (id, name, public)
VALUES ('career-documents', 'career-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ───────────────────────────  RLS: service-role only  ───────────────────────────

ALTER TABLE career_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_job_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_vacancy_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_screening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_application_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_application_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_candidate_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_assessment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_deployment_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_deployment_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_deployment_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_career_departments_all" ON career_departments;
CREATE POLICY "sr_career_departments_all" ON career_departments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_job_categories_all" ON career_job_categories;
CREATE POLICY "sr_career_job_categories_all" ON career_job_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_vacancies_all" ON career_vacancies;
CREATE POLICY "sr_career_vacancies_all" ON career_vacancies FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_vacancy_locations_all" ON career_vacancy_locations;
CREATE POLICY "sr_career_vacancy_locations_all" ON career_vacancy_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_screening_questions_all" ON career_screening_questions;
CREATE POLICY "sr_career_screening_questions_all" ON career_screening_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_question_options_all" ON career_question_options;
CREATE POLICY "sr_career_question_options_all" ON career_question_options FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_applications_all" ON career_applications;
CREATE POLICY "sr_career_applications_all" ON career_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_application_answers_all" ON career_application_answers;
CREATE POLICY "sr_career_application_answers_all" ON career_application_answers FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_application_documents_all" ON career_application_documents;
CREATE POLICY "sr_career_application_documents_all" ON career_application_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_app_status_history_all" ON career_application_status_history;
CREATE POLICY "sr_career_app_status_history_all" ON career_application_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_application_notes_all" ON career_application_notes;
CREATE POLICY "sr_career_application_notes_all" ON career_application_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_candidate_profiles_all" ON career_candidate_profiles;
CREATE POLICY "sr_career_candidate_profiles_all" ON career_candidate_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_candidate_skills_all" ON career_candidate_skills;
CREATE POLICY "sr_career_candidate_skills_all" ON career_candidate_skills FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_candidate_availability_all" ON career_candidate_availability;
CREATE POLICY "sr_career_candidate_availability_all" ON career_candidate_availability FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_assessments_all" ON career_assessments;
CREATE POLICY "sr_career_assessments_all" ON career_assessments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_assessment_candidates_all" ON career_assessment_candidates;
CREATE POLICY "sr_career_assessment_candidates_all" ON career_assessment_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_deployments_all" ON career_deployments;
CREATE POLICY "sr_career_deployments_all" ON career_deployments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_deployment_workers_all" ON career_deployment_workers;
CREATE POLICY "sr_career_deployment_workers_all" ON career_deployment_workers FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_deployment_attendance_all" ON career_deployment_attendance;
CREATE POLICY "sr_career_deployment_attendance_all" ON career_deployment_attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_deployment_performance_all" ON career_deployment_performance;
CREATE POLICY "sr_career_deployment_performance_all" ON career_deployment_performance FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_notification_log_all" ON career_notification_log;
CREATE POLICY "sr_career_notification_log_all" ON career_notification_log FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_settings_all" ON career_settings;
CREATE POLICY "sr_career_settings_all" ON career_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
