-- Business Growth Programme: intake, AI review, human selection and sponsored licence tracking.
-- Additive only. Programme records are separate from sales, paid renewals and the lead pipeline.

CREATE TABLE IF NOT EXISTS business_growth_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','OPEN','CLOSED','REVIEWING','COMPLETED','ARCHIVED')),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  award_count INTEGER NOT NULL DEFAULT 3 CHECK (award_count BETWEEN 1 AND 3),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sponsored_duration_months INTEGER NOT NULL DEFAULT 12 CHECK (sponsored_duration_months BETWEEN 1 AND 36),
  offer_acceptance_days INTEGER NOT NULL DEFAULT 7 CHECK (offer_acceptance_days BETWEEN 1 AND 30),
  activation_deadline_days INTEGER NOT NULL DEFAULT 14 CHECK (activation_deadline_days BETWEEN 1 AND 60),
  onboarding_scope TEXT NOT NULL DEFAULT '',
  exclusions TEXT NOT NULL DEFAULT '',
  renewal_price_note TEXT NOT NULL DEFAULT '',
  terms_version TEXT NOT NULL DEFAULT '1',
  terms_text TEXT NOT NULL DEFAULT '',
  privacy_version TEXT NOT NULL DEFAULT '1',
  privacy_text TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  rubric_version TEXT NOT NULL DEFAULT '1',
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  capability_reference TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at),
  CHECK (status IN ('DRAFT','ARCHIVED') OR (length(trim(onboarding_scope)) > 0 AND length(trim(terms_text)) > 0 AND length(trim(privacy_text)) > 0))
);

CREATE TABLE IF NOT EXISTS business_growth_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES business_growth_programmes(id) ON DELETE RESTRICT,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE,
  applicant_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  website TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms_version TEXT NOT NULL,
  terms_text_snapshot TEXT NOT NULL DEFAULT '',
  privacy_version TEXT NOT NULL,
  privacy_text_snapshot TEXT NOT NULL DEFAULT '',
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  accuracy_confirmed_at TIMESTAMPTZ NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  public_announcement_consent BOOLEAN NOT NULL DEFAULT false,
  public_announcement_consent_at TIMESTAMPTZ,
  clarification_token_hash TEXT,
  clarification_expires_at TIMESTAMPTZ,
  application_status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (application_status IN ('SUBMITTED','NEEDS_CLARIFICATION','READY','SHORTLISTED','INELIGIBLE','WITHDRAWN')),
  assessment_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (assessment_status IN ('QUEUED','PROCESSING','COMPLETED','FAILED')),
  assessment_attempts INTEGER NOT NULL DEFAULT 0,
  duplicate_of UUID REFERENCES business_growth_applications(id) ON DELETE SET NULL,
  assigned_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (programme_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS business_growth_applications_programme_status_idx
  ON business_growth_applications (programme_id, application_status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS business_growth_applications_score_idx
  ON business_growth_applications (programme_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS business_growth_applications_lead_idx ON business_growth_applications (lead_id);

CREATE TABLE IF NOT EXISTS business_growth_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES business_growth_applications(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLETED','FAILED')),
  model TEXT,
  prompt_version TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  recommendation TEXT CHECK (recommendation IN ('SHORTLIST','REVIEW','NEEDS_CLARIFICATION')),
  total_score INTEGER CHECK (total_score BETWEEN 0 AND 100),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  supported_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  unsupported_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarification_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  eligibility_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, version)
);
CREATE INDEX IF NOT EXISTS business_growth_assessments_app_idx
  ON business_growth_assessments (application_id, version DESC);

CREATE TABLE IF NOT EXISTS business_growth_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES business_growth_programmes(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL UNIQUE REFERENCES business_growth_applications(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('WAITLISTED','OFFERED','ACCEPTED','DECLINED','EXPIRED','ACTIVATED','NOT_SELECTED')),
  fulfilment_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (fulfilment_status IN ('NOT_STARTED','AWAITING_ACTIVATION','ACTIVATING','ACTIVE','FAILED')),
  acceptance_token_hash TEXT,
  offer_expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  activation_deadline_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  nominated_store TEXT,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  licence_id UUID REFERENCES business_licenses(id) ON DELETE SET NULL,
  plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sponsorship_reason TEXT NOT NULL DEFAULT 'MartPoint Business Growth Programme sponsorship',
  entitlement_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  activation_date DATE,
  expiry_date DATE,
  public_announcement_consent_at TIMESTAMPTZ,
  activation_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_growth_awards_programme_status_idx ON business_growth_awards (programme_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS business_growth_awards_live_application_idx
  ON business_growth_awards (programme_id, application_id)
  WHERE status IN ('OFFERED','ACCEPTED','ACTIVATED');
CREATE UNIQUE INDEX IF NOT EXISTS business_growth_awards_subscription_idx
  ON business_growth_awards (subscription_id) WHERE subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES business_growth_programmes(id) ON DELETE CASCADE,
  application_id UUID REFERENCES business_growth_applications(id) ON DELETE CASCADE,
  award_id UUID REFERENCES business_growth_awards(id) ON DELETE CASCADE,
  actor_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_growth_events_programme_idx ON business_growth_events (programme_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_growth_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES business_growth_programmes(id) ON DELETE CASCADE,
  application_id UUID REFERENCES business_growth_applications(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('ASSESS_APPLICATION','SEND_NOTIFICATION','CLOSE_PROGRAMME','EXPIRE_OFFER')),
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','RETRY','COMPLETED','DEAD')),
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_growth_jobs_due_idx ON business_growth_jobs (run_after, created_at) WHERE status IN ('QUEUED','RETRY');

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sponsorship_award_id UUID REFERENCES business_growth_awards(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_sponsorship_award_unique_idx
  ON subscriptions (sponsorship_award_id) WHERE sponsorship_award_id IS NOT NULL;

ALTER TABLE business_growth_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_growth_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_growth_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_growth_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_growth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_growth_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_growth_programmes_service_role ON business_growth_programmes;
DROP POLICY IF EXISTS business_growth_applications_service_role ON business_growth_applications;
DROP POLICY IF EXISTS business_growth_assessments_service_role ON business_growth_assessments;
DROP POLICY IF EXISTS business_growth_awards_service_role ON business_growth_awards;
DROP POLICY IF EXISTS business_growth_events_service_role ON business_growth_events;
DROP POLICY IF EXISTS business_growth_jobs_service_role ON business_growth_jobs;
CREATE POLICY business_growth_programmes_service_role ON business_growth_programmes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY business_growth_applications_service_role ON business_growth_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY business_growth_assessments_service_role ON business_growth_assessments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY business_growth_awards_service_role ON business_growth_awards FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY business_growth_events_service_role ON business_growth_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY business_growth_jobs_service_role ON business_growth_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION submit_business_growth_application(
  p_programme_id UUID,
  p_reference TEXT,
  p_applicant_name TEXT,
  p_business_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_state TEXT,
  p_city TEXT,
  p_address TEXT,
  p_industry TEXT,
  p_website TEXT,
  p_answers JSONB,
  p_marketing_consent BOOLEAN,
  p_public_announcement_consent BOOLEAN
) RETURNS TABLE(application_id UUID, lead_id UUID, reference TEXT, duplicate BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program business_growth_programmes%ROWTYPE;
  v_existing business_growth_applications%ROWTYPE;
  v_lead_id UUID;
  v_application_id UUID;
  v_email TEXT := lower(trim(p_email));
  v_now TIMESTAMPTZ := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_programme_id::text || ':' || v_email, 0));
  SELECT * INTO v_program FROM business_growth_programmes WHERE id = p_programme_id FOR SHARE;
  IF NOT FOUND OR v_program.status NOT IN ('OPEN','SCHEDULED')
     OR (v_program.opens_at IS NOT NULL AND v_now < v_program.opens_at)
     OR (v_program.closes_at IS NOT NULL AND v_now >= v_program.closes_at) THEN
    RAISE EXCEPTION 'APPLICATION_WINDOW_CLOSED';
  END IF;

  SELECT * INTO v_existing FROM business_growth_applications
   WHERE programme_id = p_programme_id AND normalized_email = v_email;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.lead_id, v_existing.reference, true;
    RETURN;
  END IF;

  INSERT INTO leads (full_name, business_name, email, phone, business_type, industry,
    product_interest, branches, staff_size, challenge, message, source, status, submitted_at, updated_at)
  VALUES (trim(p_applicant_name), trim(p_business_name), v_email, trim(p_phone),
    COALESCE(NULLIF(trim(p_industry),''),'Other'), COALESCE(NULLIF(trim(p_industry),''),'Other'),
    'RETAIL_CLOUD', '1', 'Not provided', 'Business Growth Programme application',
    'Application reference ' || p_reference, 'business_growth_programme', 'New', v_now, v_now)
  RETURNING id INTO v_lead_id;

  INSERT INTO business_growth_applications (
    programme_id, lead_id, reference, applicant_name, business_name, email, normalized_email,
    phone, state, city, address, industry, website, answers, questions_snapshot,
    terms_version, terms_text_snapshot, privacy_version, privacy_text_snapshot, terms_accepted_at, accuracy_confirmed_at,
    marketing_consent, marketing_consent_at, public_announcement_consent, public_announcement_consent_at
  ) VALUES (
    p_programme_id, v_lead_id, p_reference, trim(p_applicant_name), trim(p_business_name), v_email, v_email,
    trim(p_phone), trim(COALESCE(p_state,'')), trim(COALESCE(p_city,'')), trim(COALESCE(p_address,'')),
    trim(COALESCE(p_industry,'')), NULLIF(trim(COALESCE(p_website,'')),''), COALESCE(p_answers,'{}'::jsonb),
    v_program.questions, v_program.terms_version, v_program.terms_text, v_program.privacy_version, v_program.privacy_text, v_now, v_now,
    COALESCE(p_marketing_consent,false), CASE WHEN p_marketing_consent THEN v_now ELSE NULL END,
    COALESCE(p_public_announcement_consent,false), CASE WHEN p_public_announcement_consent THEN v_now ELSE NULL END
  ) RETURNING id INTO v_application_id;

  INSERT INTO business_growth_events (programme_id, application_id, event_type, details)
  VALUES (p_programme_id, v_application_id, 'APPLICATION_SUBMITTED', jsonb_build_object('reference', p_reference, 'lead_id', v_lead_id));
  INSERT INTO business_growth_jobs (programme_id, application_id, job_type, dedupe_key, payload)
  VALUES
    (p_programme_id, v_application_id, 'ASSESS_APPLICATION', 'assess:' || v_application_id::text, '{}'::jsonb),
    (p_programme_id, v_application_id, 'SEND_NOTIFICATION', 'ack:' || v_application_id::text, jsonb_build_object('template','ACKNOWLEDGEMENT'));

  RETURN QUERY SELECT v_application_id, v_lead_id, p_reference, false;
END;
$$;

CREATE OR REPLACE FUNCTION claim_business_growth_jobs(p_limit INTEGER DEFAULT 10)
RETURNS SETOF business_growth_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE business_growth_jobs SET status='RETRY', locked_at=NULL, run_after=now(), updated_at=now()
   WHERE status='RUNNING' AND locked_at < now() - interval '10 minutes';
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM business_growth_jobs
    WHERE status IN ('QUEUED','RETRY') AND run_after <= now()
    ORDER BY run_after, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit,10),1),50)
  )
  UPDATE business_growth_jobs j SET status='RUNNING', locked_at=now(), attempts=attempts+1, updated_at=now()
  FROM picked WHERE j.id=picked.id RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION reserve_business_growth_award(
  p_programme_id UUID,
  p_application_id UUID,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_actor UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program business_growth_programmes%ROWTYPE;
  v_application business_growth_applications%ROWTYPE;
  v_award_id UUID;
  v_live_count INTEGER;
BEGIN
  SELECT * INTO v_program FROM business_growth_programmes WHERE id=p_programme_id FOR UPDATE;
  IF NOT FOUND OR v_program.status NOT IN ('CLOSED','REVIEWING') THEN
    RAISE EXCEPTION 'PROGRAMME_MUST_BE_CLOSED_FOR_SELECTION';
  END IF;
  SELECT * INTO v_application FROM business_growth_applications WHERE id=p_application_id AND programme_id=p_programme_id FOR UPDATE;
  IF NOT FOUND OR v_application.application_status <> 'SHORTLISTED' OR v_application.assessment_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'APPLICATION_NOT_READY_FOR_AWARD';
  END IF;
  SELECT count(*) INTO v_live_count FROM business_growth_awards
    WHERE programme_id=p_programme_id AND status IN ('OFFERED','ACCEPTED','ACTIVATED');
  IF v_live_count >= v_program.award_count THEN RAISE EXCEPTION 'PROGRAMME_AWARD_LIMIT_REACHED'; END IF;
  INSERT INTO business_growth_awards (programme_id, application_id, status, fulfilment_status,
    acceptance_token_hash, offer_expires_at, plan_snapshot, created_by)
  VALUES (p_programme_id, p_application_id, 'OFFERED', 'NOT_STARTED', p_token_hash, p_expires_at, v_program.plan_snapshot, p_actor)
  RETURNING id INTO v_award_id;
  INSERT INTO business_growth_events (programme_id, application_id, award_id, actor_admin_user_id, event_type, details)
  VALUES (p_programme_id, p_application_id, v_award_id, p_actor, 'AWARD_OFFERED', jsonb_build_object('expires_at',p_expires_at));
  INSERT INTO business_growth_jobs (programme_id, application_id, job_type, dedupe_key, payload, run_after)
  VALUES (p_programme_id, p_application_id, 'EXPIRE_OFFER', 'expire:' || v_award_id::text, jsonb_build_object('award_id',v_award_id), p_expires_at);
  RETURN v_award_id;
END;
$$;

CREATE OR REPLACE FUNCTION submit_business_growth_clarification(p_token_hash TEXT, p_responses JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app business_growth_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_app FROM business_growth_applications
   WHERE clarification_token_hash = p_token_hash
     AND clarification_expires_at > now()
     AND application_status = 'NEEDS_CLARIFICATION'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLARIFICATION_LINK_INVALID_OR_EXPIRED'; END IF;
  UPDATE business_growth_applications SET
    answers = answers || jsonb_build_object('follow_up_answers', COALESCE(p_responses, '[]'::jsonb)),
    clarification_token_hash = NULL,
    clarification_expires_at = NULL,
    application_status = 'SUBMITTED',
    assessment_status = 'QUEUED',
    updated_at = now()
  WHERE id = v_app.id;
  INSERT INTO business_growth_jobs (programme_id, application_id, job_type, dedupe_key, payload)
  VALUES (v_app.programme_id, v_app.id, 'ASSESS_APPLICATION', 'clarify-assess:' || gen_random_uuid()::text, '{}'::jsonb);
  INSERT INTO business_growth_jobs (programme_id, application_id, job_type, dedupe_key, payload)
  VALUES (v_app.programme_id, v_app.id, 'SEND_NOTIFICATION', 'clarification-received:' || gen_random_uuid()::text, jsonb_build_object('template','CLARIFICATION_RECEIVED'));
  INSERT INTO business_growth_events (programme_id, application_id, event_type)
  VALUES (v_app.programme_id, v_app.id, 'CLARIFICATION_SUBMITTED');
  RETURN v_app.id;
END;
$$;

CREATE OR REPLACE FUNCTION respond_business_growth_offer(
  p_token_hash TEXT,
  p_accept BOOLEAN,
  p_nominated_store TEXT,
  p_public_announcement_consent BOOLEAN
) RETURNS TABLE(award_id UUID, programme_id UUID, application_id UUID, resulting_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_award business_growth_awards%ROWTYPE;
  v_deadline_days INTEGER;
  v_activation_deadline TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  SELECT * INTO v_award FROM business_growth_awards
   WHERE acceptance_token_hash = p_token_hash
     AND status = 'OFFERED'
     AND offer_expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OFFER_INVALID_OR_EXPIRED'; END IF;
  SELECT activation_deadline_days INTO v_deadline_days FROM business_growth_programmes WHERE id=v_award.programme_id;
  v_status := CASE WHEN p_accept THEN 'ACCEPTED' ELSE 'DECLINED' END;
  v_activation_deadline := CASE WHEN p_accept THEN now() + make_interval(days => COALESCE(v_deadline_days,14)) ELSE NULL END;
  UPDATE business_growth_awards SET status=v_status,
    acceptance_token_hash=NULL,
    accepted_at=CASE WHEN p_accept THEN now() ELSE accepted_at END,
    declined_at=CASE WHEN p_accept THEN NULL ELSE now() END,
    activation_deadline_at=v_activation_deadline,
    nominated_store=CASE WHEN p_accept THEN NULLIF(trim(p_nominated_store),'') ELSE nominated_store END,
    public_announcement_consent_at=CASE WHEN p_accept AND p_public_announcement_consent THEN now() ELSE NULL END,
    updated_at=now()
  WHERE id=v_award.id;
  INSERT INTO business_growth_events (programme_id, application_id, award_id, event_type, details)
  VALUES (v_award.programme_id, v_award.application_id, v_award.id,
    CASE WHEN p_accept THEN 'OFFER_ACCEPTED' ELSE 'OFFER_DECLINED' END,
    jsonb_build_object('public_announcement_consent', p_accept AND p_public_announcement_consent));
  INSERT INTO business_growth_jobs (programme_id, application_id, job_type, dedupe_key, payload)
  VALUES (v_award.programme_id, v_award.application_id, 'SEND_NOTIFICATION',
    lower(v_status) || ':' || v_award.id::text,
    jsonb_build_object('template', CASE WHEN p_accept THEN 'OFFER_ACCEPTED' ELSE 'OFFER_DECLINED' END));
  RETURN QUERY SELECT v_award.id, v_award.programme_id, v_award.application_id, v_status;
END;
$$;

CREATE OR REPLACE FUNCTION prepare_business_growth_activation(p_award_id UUID, p_actor UUID)
RETURNS TABLE(business_id UUID, subscription_id UUID, already_prepared BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_award business_growth_awards%ROWTYPE;
  v_app business_growth_applications%ROWTYPE;
  v_program business_growth_programmes%ROWTYPE;
  v_plan plans%ROWTYPE;
  v_business_id UUID;
  v_subscription_id UUID;
  v_end_date DATE;
  v_existing_license UUID;
  v_existing_subscription UUID;
  v_matching_businesses INTEGER;
BEGIN
  SELECT * INTO v_award FROM business_growth_awards WHERE id=p_award_id FOR UPDATE;
  IF NOT FOUND OR v_award.status NOT IN ('ACCEPTED') OR v_award.fulfilment_status NOT IN ('NOT_STARTED','FAILED','ACTIVATING') THEN
    RAISE EXCEPTION 'AWARD_NOT_READY_FOR_ACTIVATION';
  END IF;
  IF v_award.subscription_id IS NOT NULL THEN
    IF v_award.fulfilment_status = 'ACTIVATING' THEN
      RETURN QUERY SELECT v_award.business_id, v_award.subscription_id, true;
      RETURN;
    END IF;
    UPDATE business_growth_awards SET fulfilment_status='ACTIVATING', activation_error=NULL, updated_at=now() WHERE id=v_award.id;
    RETURN QUERY SELECT v_award.business_id, v_award.subscription_id, false;
    RETURN;
  END IF;
  SELECT * INTO v_app FROM business_growth_applications WHERE id=v_award.application_id;
  SELECT * INTO v_program FROM business_growth_programmes WHERE id=v_award.programme_id;
  SELECT * INTO v_plan FROM plans WHERE id=v_program.plan_id;
  IF NOT FOUND OR NOT v_plan.active THEN RAISE EXCEPTION 'BASIC_PLAN_UNAVAILABLE'; END IF;
  IF v_plan.code <> COALESCE(v_program.plan_snapshot->>'code','')
     OR v_plan.billing_interval <> COALESCE(v_program.plan_snapshot->>'billing_interval','')
     OR v_plan.included_branches <> COALESCE((v_program.plan_snapshot->>'included_branches')::INTEGER,-1)
     OR v_plan.included_users <> COALESCE((v_program.plan_snapshot->>'included_users')::INTEGER,-1)
     OR v_plan.online_store_included <> COALESCE((v_program.plan_snapshot->>'online_store_included')::BOOLEAN,false)
     OR v_plan.base_price <> COALESCE((v_program.plan_snapshot->>'base_price')::NUMERIC,-1)
     OR v_plan.currency <> COALESCE(v_program.plan_snapshot->>'currency','') THEN
    RAISE EXCEPTION 'BASIC_PLAN_CHANGED_AFTER_PROGRAMME_PUBLISHED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(v_app.email), 0));
  SELECT count(*) INTO v_matching_businesses FROM businesses WHERE lower(primary_email)=lower(v_app.email);
  IF v_matching_businesses > 1 THEN RAISE EXCEPTION 'MULTIPLE_BUSINESSES_MATCH_APPLICANT_EMAIL'; END IF;
  SELECT id INTO v_business_id FROM businesses WHERE lower(primary_email)=lower(v_app.email) LIMIT 1;
  IF v_business_id IS NULL THEN
    INSERT INTO businesses (business_name, primary_contact_name, primary_email, primary_phone,
      business_type, industry, country, state, city, address, website, status, source, source_lead_id, created_by)
    VALUES (v_app.business_name, v_app.applicant_name, v_app.email, v_app.phone,
      COALESCE(NULLIF(v_app.industry,''),'Other'), COALESCE(NULLIF(v_app.industry,''),'Other'),
      'Nigeria', v_app.state, v_app.city, v_app.address, v_app.website, 'ONBOARDING', 'CAMPAIGN', v_app.lead_id, p_actor)
    RETURNING id INTO v_business_id;
  END IF;
  SELECT id INTO v_existing_license FROM business_licenses WHERE business_id=v_business_id;
  IF v_existing_license IS NOT NULL THEN RAISE EXCEPTION 'BUSINESS_ALREADY_HAS_LICENCE'; END IF;
  SELECT id INTO v_existing_subscription FROM subscriptions
   WHERE business_id=v_business_id AND status IN ('ACTIVE','WAIVED','PAST_DUE','SUSPENDED') LIMIT 1;
  IF v_existing_subscription IS NOT NULL THEN RAISE EXCEPTION 'BUSINESS_ALREADY_HAS_LIVE_SUBSCRIPTION'; END IF;

  v_end_date := (CURRENT_DATE + make_interval(months => v_program.sponsored_duration_months))::DATE;
  INSERT INTO subscriptions (business_id, plan_id, status, billing_interval, start_date,
    current_period_start, current_period_end, renewal_date, auto_renew, price_at_activation,
    currency, created_by, sponsorship_award_id)
  VALUES (v_business_id, v_program.plan_id, 'PENDING', 'ANNUAL', CURRENT_DATE,
    CURRENT_DATE, v_end_date, NULL, false, 0, v_plan.currency, p_actor, v_award.id)
  ON CONFLICT (sponsorship_award_id) WHERE sponsorship_award_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_subscription_id;
  IF v_subscription_id IS NULL THEN
    SELECT id INTO v_subscription_id FROM subscriptions WHERE sponsorship_award_id=v_award.id;
  END IF;
  UPDATE business_growth_awards SET business_id=v_business_id, subscription_id=v_subscription_id,
    fulfilment_status='ACTIVATING', activation_error=NULL, updated_at=now()
  WHERE id=v_award.id;
  INSERT INTO business_growth_events (programme_id, application_id, award_id, actor_admin_user_id, event_type, details)
  VALUES (v_award.programme_id, v_award.application_id, v_award.id, p_actor, 'LICENCE_ACTIVATION_PREPARED',
    jsonb_build_object('business_id',v_business_id,'subscription_id',v_subscription_id,'expires_on',v_end_date));
  RETURN QUERY SELECT v_business_id, v_subscription_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION complete_business_growth_programme(p_programme_id UUID, p_actor UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program business_growth_programmes%ROWTYPE;
  v_pending UUID;
  v_app RECORD;
  v_award_id UUID;
BEGIN
  SELECT * INTO v_program FROM business_growth_programmes WHERE id=p_programme_id FOR UPDATE;
  IF NOT FOUND OR v_program.status NOT IN ('CLOSED','REVIEWING') THEN
    RAISE EXCEPTION 'PROGRAMME_MUST_BE_CLOSED_BEFORE_COMPLETION';
  END IF;
  IF EXISTS (SELECT 1 FROM business_growth_awards WHERE programme_id=p_programme_id AND status='OFFERED') THEN
    RAISE EXCEPTION 'OUTSTANDING_OFFERS_MUST_BE_RESOLVED';
  END IF;
  IF EXISTS (SELECT 1 FROM business_growth_applications WHERE programme_id=p_programme_id AND application_status='NEEDS_CLARIFICATION') THEN
    RAISE EXCEPTION 'CLARIFICATION_REQUESTS_MUST_BE_RESOLVED';
  END IF;
  SELECT a.id INTO v_pending FROM business_growth_applications a
   LEFT JOIN business_growth_awards w ON w.application_id=a.id
   WHERE a.programme_id=p_programme_id
     AND a.application_status NOT IN ('WITHDRAWN','INELIGIBLE')
     AND a.assessment_status <> 'COMPLETED'
     AND COALESCE(w.status,'') NOT IN ('WAITLISTED','NOT_SELECTED','DECLINED','EXPIRED')
   LIMIT 1;
  IF v_pending IS NOT NULL THEN RAISE EXCEPTION 'APPLICATION_ASSESSMENTS_MUST_BE_RESOLVED'; END IF;

  FOR v_app IN
    SELECT a.id, a.application_status, w.id AS award_id, w.status AS award_status
      FROM business_growth_applications a
      LEFT JOIN business_growth_awards w ON w.application_id=a.id
     WHERE a.programme_id=p_programme_id
       AND a.application_status NOT IN ('WITHDRAWN','INELIGIBLE')
       AND COALESCE(w.status,'') NOT IN ('ACCEPTED','ACTIVATED','NOT_SELECTED')
  LOOP
    v_award_id := v_app.award_id;
    IF v_award_id IS NULL THEN
      INSERT INTO business_growth_awards(programme_id,application_id,status,fulfilment_status,created_by)
      VALUES(p_programme_id,v_app.id,'NOT_SELECTED','NOT_STARTED',p_actor)
      ON CONFLICT(application_id) DO UPDATE SET status='NOT_SELECTED',fulfilment_status='NOT_STARTED',updated_at=now()
      RETURNING id INTO v_award_id;
    ELSE
      UPDATE business_growth_awards SET status='NOT_SELECTED',fulfilment_status='NOT_STARTED',updated_at=now()
       WHERE id=v_award_id;
    END IF;
    INSERT INTO business_growth_jobs(programme_id,application_id,job_type,dedupe_key,payload)
    VALUES(p_programme_id,v_app.id,'SEND_NOTIFICATION','final-outcome:'||v_app.id::text,jsonb_build_object('template','NOT_SELECTED'))
    ON CONFLICT(dedupe_key) DO NOTHING;
  END LOOP;

  UPDATE business_growth_programmes SET status='COMPLETED',updated_at=now() WHERE id=p_programme_id;
  INSERT INTO business_growth_events(programme_id,actor_admin_user_id,event_type,reason,details)
  VALUES(p_programme_id,p_actor,'PROGRAMME_COMPLETE',p_reason,jsonb_build_object('from',v_program.status,'to','COMPLETED'));
END;
$$;

REVOKE ALL ON FUNCTION submit_business_growth_application(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_business_growth_application(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN,BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION claim_business_growth_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_business_growth_jobs(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION reserve_business_growth_award(UUID,UUID,TEXT,TIMESTAMPTZ,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_business_growth_award(UUID,UUID,TEXT,TIMESTAMPTZ,UUID) TO service_role;
REVOKE ALL ON FUNCTION submit_business_growth_clarification(TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_business_growth_clarification(TEXT,JSONB) TO service_role;
REVOKE ALL ON FUNCTION respond_business_growth_offer(TEXT,BOOLEAN,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION respond_business_growth_offer(TEXT,BOOLEAN,TEXT,BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION prepare_business_growth_activation(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prepare_business_growth_activation(UUID,UUID) TO service_role;
REVOKE ALL ON FUNCTION complete_business_growth_programme(UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_business_growth_programme(UUID,UUID,TEXT) TO service_role;
