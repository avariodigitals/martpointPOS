-- Additive partner lifecycle automation. Existing partner/account and commission
-- rows are preserved; public listings are backfilled to their current visibility.
CREATE TABLE IF NOT EXISTS partner_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  effective_at TIMESTAMPTZ NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO partner_policy_versions(version,effective_at,config_json)
VALUES ('2026-01', now(), '{"probation_days":90,"activity_threshold":1,"activity_max_age_days":30,"notice_response_business_days":10,"inactivity_reminder_days":30,"inactivity_warning_days":60,"pending_suspension_days":90,"policy_text":"The activation period lasts 90 calendar days after policy acceptance/effective date and approved onboarding. At least one verified qualified lead, attended client demo, submitted proposal, closed-won deal, or documented client meeting is required. After directory publication, reminders begin after 30 days without verified qualifying activity, a warning follows after 60 days, and at 90 days a suspension notice may begin a 10-business-day response period. A listing suspension is independent from account access and accrued commissions. Compliance concerns receive human review; selling competing software alone is not a violation unless an applicable signed agreement expressly prohibits it. Login activity does not qualify. Partners may submit records for human verification and respond to notices and cases."}'::jsonb)
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS partner_lifecycle (
  partner_id UUID PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
  policy_version_id UUID REFERENCES partner_policy_versions(id) ON DELETE SET NULL,
  accepted_version TEXT,
  accepted_at TIMESTAMPTZ,
  effective_at TIMESTAMPTZ,
  account_status TEXT NOT NULL DEFAULT 'enabled' CHECK(account_status IN ('pending','enabled','restricted','closed')),
  onboarding_status TEXT NOT NULL DEFAULT 'incomplete' CHECK(onboarding_status IN ('incomplete','pending_review','approved')),
  performance_status TEXT NOT NULL DEFAULT 'unassessed' CHECK(performance_status IN ('unassessed','probation','on_track','at_risk','review_required','compliant','noncompliant')),
  listing_status TEXT NOT NULL DEFAULT 'hidden' CHECK(listing_status IN ('hidden','eligible','published','pending_suspension','suspended')),
  compliance_status TEXT NOT NULL DEFAULT 'clear' CHECK(compliance_status IN ('clear','open_case','under_review','confirmed_violation')),
  probation_start_at TIMESTAMPTZ,
  probation_end_at TIMESTAMPTZ,
  transition_start_at TIMESTAMPTZ,
  last_verified_activity_at TIMESTAMPTZ,
  review_hold_until TIMESTAMPTZ,
  extension_until TIMESTAMPTZ,
  response_deadline_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version_counter BIGINT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS partner_lifecycle_status_idx ON partner_lifecycle(listing_status, performance_status, updated_at);

-- Preserve current visibility for legacy partners, but do not start a policy clock.
INSERT INTO partner_lifecycle(partner_id, account_status, onboarding_status, listing_status, transition_start_at)
SELECT id, CASE WHEN status='ACTIVE' THEN 'enabled' ELSE 'pending' END,
       CASE WHEN status='ACTIVE' THEN 'approved' ELSE 'incomplete' END,
       CASE WHEN status='ACTIVE' AND public_profile_enabled THEN 'published' ELSE 'hidden' END,
       NULL
FROM partners ON CONFLICT(partner_id) DO NOTHING;

CREATE OR REPLACE FUNCTION partner_lifecycle_on_registration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO partner_lifecycle(partner_id, account_status, onboarding_status, listing_status)
  VALUES(NEW.id, CASE WHEN NEW.status='ACTIVE' THEN 'enabled' ELSE 'pending' END, 'incomplete', 'hidden')
  ON CONFLICT(partner_id) DO NOTHING;
  -- A new partner account never enters the public directory by registration alone.
  UPDATE partners SET public_profile_enabled=false WHERE id=NEW.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_partner_lifecycle_registration ON partners;
CREATE TRIGGER trg_partner_lifecycle_registration AFTER INSERT ON partners
FOR EACH ROW EXECUTE FUNCTION partner_lifecycle_on_registration();

CREATE TABLE IF NOT EXISTS partner_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  policy_version_id UUID NOT NULL REFERENCES partner_policy_versions(id) ON DELETE RESTRICT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_partner_user_id UUID,
  UNIQUE(partner_id, policy_version_id)
);
CREATE TABLE IF NOT EXISTS partner_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('qualified_lead','attended_demo','proposal_submitted','closed_won','documented_client_meeting')),
  source_record_type TEXT, source_record_id UUID, description TEXT NOT NULL DEFAULT '', evidence_url TEXT,
  consent_confirmed BOOLEAN NOT NULL DEFAULT false, lawful_basis TEXT CHECK(lawful_basis IS NULL OR lawful_basis IN ('consent','contract','legitimate_interest','other')),
  occurred_at TIMESTAMPTZ NOT NULL, verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','rejected')),
  verified_at TIMESTAMPTZ, verified_by UUID, rejection_reason TEXT, unique_source_key TEXT UNIQUE,
  submitted_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_activities_partner_verified_idx ON partner_activities(partner_id,verification_status,occurred_at DESC);
CREATE TABLE IF NOT EXISTS partner_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(), evaluation_period_start TIMESTAMPTZ, evaluation_period_end TIMESTAMPTZ,
  policy_version_id UUID REFERENCES partner_policy_versions(id) ON DELETE SET NULL, metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision TEXT NOT NULL, explanation TEXT NOT NULL, dry_run BOOLEAN NOT NULL DEFAULT true, next_review_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS partner_evaluations_partner_idx ON partner_evaluations(partner_id,evaluated_at DESC);
CREATE TABLE IF NOT EXISTS partner_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  notice_type TEXT NOT NULL, due_at TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'queued' CHECK(delivery_status IN ('queued','sending','sent','failed','permanent_failure')),
  idempotency_key TEXT NOT NULL UNIQUE, template_version TEXT NOT NULL DEFAULT '1', subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
  response_deadline_at TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0, last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_notices_due_idx ON partner_notices(delivery_status,due_at);
CREATE TABLE IF NOT EXISTS partner_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  case_type TEXT NOT NULL, opening_reason TEXT NOT NULL DEFAULT '', opened_by UUID, idempotency_key TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','under_review','resolved','dismissed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(), response_deadline_at TIMESTAMPTZ,
  partner_response TEXT, response_evidence_url TEXT, responded_at TIMESTAMPTZ, resolution TEXT, resolved_by UUID, resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS partner_admin_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK(override_type IN ('hold','extension','listing_status','activity_decision','case')),
  reason TEXT NOT NULL, expires_at TIMESTAMPTZ, approved_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS partner_lifecycle_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id), feature_enabled BOOLEAN NOT NULL DEFAULT false,
  dry_run BOOLEAN NOT NULL DEFAULT true, auto_suspension_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reinstate_enabled BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID
);
INSERT INTO partner_lifecycle_settings(id) VALUES(true) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS partner_business_holidays (
  holiday_date DATE PRIMARY KEY, label TEXT NOT NULL DEFAULT '', calendar_year INTEGER NOT NULL
);
ALTER TABLE partner_business_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_business_holidays_all" ON partner_business_holidays;
CREATE POLICY "sr_partner_business_holidays_all" ON partner_business_holidays FOR ALL TO service_role USING(true) WITH CHECK(true);

-- Server-side public directory gate; backfill means existing published profiles remain visible.
ALTER TABLE partner_lifecycle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_lifecycle_all" ON partner_lifecycle;
CREATE POLICY "sr_partner_lifecycle_all" ON partner_lifecycle FOR ALL TO service_role USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS "anon_partner_lifecycle_public" ON partner_lifecycle;
CREATE POLICY "anon_partner_lifecycle_public" ON partner_lifecycle FOR SELECT TO anon
  USING(listing_status IN ('published','pending_suspension') AND account_status='enabled' AND compliance_status IN ('clear','open_case','under_review'));
-- Public directory joins need only these four fields. Do not expose policy acceptance,
-- holds, response deadlines, or other lifecycle internals through the REST schema.
REVOKE ALL ON partner_lifecycle FROM anon, authenticated;
GRANT SELECT (partner_id, listing_status, account_status, compliance_status) ON partner_lifecycle TO anon;
DROP POLICY IF EXISTS "anon_partners_public" ON partners;
CREATE POLICY "anon_partners_public" ON partners FOR SELECT TO anon
  USING(status='ACTIVE' AND public_profile_enabled=true AND EXISTS (
    SELECT 1 FROM partner_lifecycle pl WHERE pl.partner_id=partners.id
      AND pl.listing_status IN ('published','pending_suspension') AND pl.account_status='enabled'
      AND pl.compliance_status IN ('clear','open_case','under_review')
  ));
ALTER TABLE partner_policy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_policy_versions_all" ON partner_policy_versions FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_policy_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_policy_acceptances_all" ON partner_policy_acceptances FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_activities_all" ON partner_activities FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_evaluations_all" ON partner_evaluations FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_notices_all" ON partner_notices FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_cases_all" ON partner_cases FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_admin_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_admin_overrides_all" ON partner_admin_overrides FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE partner_lifecycle_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_partner_lifecycle_settings_all" ON partner_lifecycle_settings FOR ALL TO service_role USING(true) WITH CHECK(true);

NOTIFY pgrst,'reload schema';
