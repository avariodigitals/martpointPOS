-- 059: Careers — conversion-first workforce role templates, commission engine,
-- conversion-pipeline ownership & handover log.
--
-- Extends the careers module (054-056) without changing existing behaviour:
--   * career_role_templates       — reusable vacancy blueprints an admin picks
--                                  when creating a vacancy; prefill only.
--   * career_role_template_versions — immutable snapshot on every template edit.
--   * career_commissions          — commission ledger (earned → payable → paid),
--                                  only ever computed from qualifying collected
--                                  revenue.
--   * career_pipeline_stage_owners — which workforce role owns each conversion
--                                  stage (seeded in 060).
--   * career_pipeline_handovers    — audit record of every stage handover.
--   * career_vacancies            — extra columns mirrored from templates plus
--                                  extended compensation_type CHECK.
--   * career_applications         — vacancy-specific consent columns.
--
-- Money convention: integer kobo, consistent with the rest of the module.
-- Idempotent — safe to re-run.

-- ───────────────────────────  Role templates  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role_category TEXT NOT NULL DEFAULT 'CORE'
    CHECK (role_category IN ('CORE','FLEXIBLE','RETAINER')),
  department_id UUID REFERENCES career_departments(id) ON DELETE SET NULL,
  job_category_id UUID REFERENCES career_job_categories(id) ON DELETE SET NULL,

  purpose TEXT,

  employment_type TEXT NOT NULL DEFAULT 'PERMANENT'
    CHECK (employment_type IN ('PERMANENT','CONTRACT','TEMPORARY','INTERNSHIP','PROJECT_BASED','ON_CALL_FIELD')),
  work_arrangement TEXT NOT NULL DEFAULT 'HYBRID'
    CHECK (work_arrangement IN ('ON_SITE','REMOTE','HYBRID','FIELD_BASED')),
  -- {country,state,lga,city,public_description,nearby_preferred}
  default_location JSONB NOT NULL DEFAULT '{}'::jsonb,
  openings INTEGER NOT NULL DEFAULT 1 CHECK (openings > 0),

  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  requirements TEXT[] NOT NULL DEFAULT '{}',
  performance_indicators TEXT[] NOT NULL DEFAULT '{}',
  reporting_line TEXT,
  working_days TEXT,
  work_start_time TEXT,
  work_end_time TEXT,
  probation_period TEXT,

  base_compensation_kobo BIGINT,
  compensation_type TEXT NOT NULL DEFAULT 'NEGOTIABLE'
    CHECK (compensation_type IN (
      'DAILY','WEEKLY','MONTHLY','PROJECT_FEE','COMMISSION_ONLY','RETAINER',
      'SALARY_PLUS_COMMISSION','DAILY_PLUS_TRANSPORT','NEGOTIABLE'
    )),
  currency TEXT NOT NULL DEFAULT 'NGN',
  transport_allowance_kobo BIGINT,
  feeding_arrangement TEXT,
  data_call_allowance_kobo BIGINT,
  commission_eligible BOOLEAN NOT NULL DEFAULT false,
  -- CommissionConfig: eligible_categories, excluded_categories, basis,
  -- percentage, fixed_amount_kobo, self_lead_rate, company_lead_rate,
  -- minimum_payout_kobo, clawback_on_refund, include_overrides
  commission_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  performance_bonus TEXT,
  show_compensation_public BOOLEAN NOT NULL DEFAULT false,

  -- Same keys as career_vacancies.equipment_fields plus optional "items" list.
  required_equipment JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- [{question_text, answer_type, required, knockout, options[]}]
  screening_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  assessment_type TEXT
    CHECK (assessment_type IS NULL OR assessment_type IN ('WRITTEN','PRACTICAL','PRODUCT_CAPTURE','INTERVIEW','OTHER')),
  -- [{criterion, max_score}]
  interview_scorecard JSONB NOT NULL DEFAULT '[]'::jsonb,
  consent_text TEXT,

  status TEXT NOT NULL DEFAULT 'INACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  version INTEGER NOT NULL DEFAULT 1,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, role_category)
);

CREATE INDEX IF NOT EXISTS career_role_templates_status_idx ON career_role_templates (status);
CREATE INDEX IF NOT EXISTS career_role_templates_category_idx ON career_role_templates (role_category);

-- Immutable snapshot written on every update — version history.
CREATE TABLE IF NOT EXISTS career_role_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES career_role_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS career_role_template_versions_idx ON career_role_template_versions (template_id, version DESC);

-- ───────────────────────────  Vacancy extensions  ───────────────────────────

ALTER TABLE career_vacancies
  ADD COLUMN IF NOT EXISTS role_template_id UUID REFERENCES career_role_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_purpose TEXT,
  ADD COLUMN IF NOT EXISTS probation_period TEXT,
  ADD COLUMN IF NOT EXISTS reporting_line TEXT,
  ADD COLUMN IF NOT EXISTS performance_indicators TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feeding_arrangement TEXT,
  ADD COLUMN IF NOT EXISTS data_call_allowance_kobo BIGINT,
  ADD COLUMN IF NOT EXISTS commission_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS performance_bonus TEXT,
  ADD COLUMN IF NOT EXISTS required_equipment JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assessment_type TEXT,
  ADD COLUMN IF NOT EXISTS interview_scorecard JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;

CREATE INDEX IF NOT EXISTS career_vacancies_template_idx ON career_vacancies (role_template_id);

-- Expanded compensation models. The old CHECK only allowed
-- DAILY/WEEKLY/MONTHLY/PROJECT_FEE/NEGOTIABLE.
ALTER TABLE career_vacancies
  DROP CONSTRAINT IF EXISTS career_vacancies_compensation_type_check;
ALTER TABLE career_vacancies
  ADD CONSTRAINT career_vacancies_compensation_type_check
  CHECK (compensation_type IN (
    'DAILY','WEEKLY','MONTHLY','PROJECT_FEE','COMMISSION_ONLY','RETAINER',
    'SALARY_PLUS_COMMISSION','DAILY_PLUS_TRANSPORT','NEGOTIABLE'
  ));

-- ───────────────────────────  Application consent  ───────────────────────────

ALTER TABLE career_applications
  ADD COLUMN IF NOT EXISTS consent_vacancy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_vacancy_text TEXT;

-- ───────────────────────────  Commission ledger  ───────────────────────────
-- Commission is only ever earned on qualifying collected revenue. Taxes,
-- refunds, logistics, reimbursable expenses and hardware are excluded by
-- default unless management explicitly re-includes a category via
-- commission_rules.include_overrides on the vacancy/template.

CREATE TABLE IF NOT EXISTS career_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  earner_label TEXT NOT NULL,
  candidate_id UUID REFERENCES career_candidate_profiles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vacancy_id UUID REFERENCES career_vacancies(id) ON DELETE SET NULL,
  role_template_id UUID REFERENCES career_role_templates(id) ON DELETE SET NULL,

  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

  revenue_category TEXT NOT NULL,
  lead_source TEXT NOT NULL DEFAULT 'COMPANY_GENERATED'
    CHECK (lead_source IN ('SELF_GENERATED','COMPANY_GENERATED')),
  qualifying_amount_kobo BIGINT NOT NULL CHECK (qualifying_amount_kobo >= 0),
  basis TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (basis IN ('PERCENTAGE','FIXED')),
  rate NUMERIC,
  amount_kobo BIGINT NOT NULL DEFAULT 0,

  approval_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
  payment_status TEXT NOT NULL DEFAULT 'EARNED'
    CHECK (payment_status IN ('EARNED','PAYABLE','PAID','REVERSED')),

  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payable_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reversal_of_id UUID REFERENCES career_commissions(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_commissions_candidate_idx ON career_commissions (candidate_id);
CREATE INDEX IF NOT EXISTS career_commissions_lead_idx ON career_commissions (lead_id);
CREATE INDEX IF NOT EXISTS career_commissions_status_idx ON career_commissions (approval_status, payment_status);
CREATE INDEX IF NOT EXISTS career_commissions_earned_idx ON career_commissions (earned_at DESC);

-- ───────────────────────────  Conversion pipeline ownership  ───────────────────────────

CREATE TABLE IF NOT EXISTS career_pipeline_stage_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  responsible_role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every handover between owners is recorded — who, what, when, what's needed.
CREATE TABLE IF NOT EXISTS career_pipeline_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_type TEXT NOT NULL DEFAULT 'LEAD' CHECK (subject_type IN ('LEAD','CUSTOMER')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  subject_label TEXT,

  pipeline_stage TEXT NOT NULL,
  previous_owner TEXT,
  new_owner TEXT NOT NULL,
  previous_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  new_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

  handed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  required_action TEXT,
  deadline TIMESTAMPTZ,
  notes TEXT,
  attached_documents JSONB NOT NULL DEFAULT '[]'::jsonb,

  acceptance_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (acceptance_status IN ('PENDING','ACCEPTED','DECLINED')),
  accepted_at TIMESTAMPTZ,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_pipeline_handovers_lead_idx ON career_pipeline_handovers (lead_id);
CREATE INDEX IF NOT EXISTS career_pipeline_handovers_business_idx ON career_pipeline_handovers (business_id);
CREATE INDEX IF NOT EXISTS career_pipeline_handovers_stage_idx ON career_pipeline_handovers (pipeline_stage);
CREATE INDEX IF NOT EXISTS career_pipeline_handovers_acceptance_idx ON career_pipeline_handovers (acceptance_status);

-- ───────────────────────────  RLS: service-role only  ───────────────────────────

ALTER TABLE career_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_role_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_pipeline_stage_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_pipeline_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_career_role_templates_all" ON career_role_templates;
CREATE POLICY "sr_career_role_templates_all" ON career_role_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_role_template_versions_all" ON career_role_template_versions;
CREATE POLICY "sr_career_role_template_versions_all" ON career_role_template_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_commissions_all" ON career_commissions;
CREATE POLICY "sr_career_commissions_all" ON career_commissions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_pipeline_stage_owners_all" ON career_pipeline_stage_owners;
CREATE POLICY "sr_career_pipeline_stage_owners_all" ON career_pipeline_stage_owners FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sr_career_pipeline_handovers_all" ON career_pipeline_handovers;
CREATE POLICY "sr_career_pipeline_handovers_all" ON career_pipeline_handovers FOR ALL TO service_role USING (true) WITH CHECK (true);
