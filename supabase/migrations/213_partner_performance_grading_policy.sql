-- Partner grading policy v1.0 and per-Partner-Type grade history.
-- The policy is deliberately a draft until Management publishes it.
ALTER TABLE public.partner_delivery_verifications
  ADD COLUMN IF NOT EXISTS partner_type TEXT,
  ADD COLUMN IF NOT EXISTS outcome_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS partner_delivery_unique_outcome_idx
  ON public.partner_delivery_verifications(partner_id, partner_type, outcome_reference)
  WHERE approved = true AND partner_type IS NOT NULL AND outcome_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.partner_grading_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_reference TEXT NOT NULL DEFAULT 'MP-POL-PGP-001',
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','SUPERSEDED')),
  effective_at TIMESTAMPTZ,
  silver_outcomes INTEGER NOT NULL DEFAULT 1 CHECK (silver_outcomes > 0),
  gold_outcomes INTEGER NOT NULL DEFAULT 10 CHECK (gold_outcomes > 0),
  platinum_outcomes INTEGER NOT NULL DEFAULT 25 CHECK (platinum_outcomes > 0),
  silver_min_days INTEGER NOT NULL DEFAULT 90,
  gold_min_days INTEGER NOT NULL DEFAULT 183,
  platinum_min_days INTEGER NOT NULL DEFAULT 365,
  rolling_window_days INTEGER NOT NULL DEFAULT 365,
  criteria JSONB NOT NULL DEFAULT '{"partnerTypes":["CHANNEL","IMPLEMENTATION"],"requirements":["completed onboarding","applicable certification","satisfactory customer outcomes","satisfactory compliance","management approval","performance review"]}'::jsonb,
  created_by UUID,
  approved_by UUID,
  approval_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_reference, version)
);
INSERT INTO public.partner_grading_policies(policy_reference, version, status)
VALUES ('MP-POL-PGP-001','1.0','DRAFT') ON CONFLICT (policy_reference, version) DO NOTHING;
ALTER TABLE public.partner_grading_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_grading_policies_all" ON public.partner_grading_policies;
CREATE POLICY "sr_partner_grading_policies_all" ON public.partner_grading_policies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.partner_type_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('CHANNEL','IMPLEMENTATION')),
  current_grade TEXT NOT NULL DEFAULT 'UNGRADED' CHECK (current_grade IN ('UNGRADED','SILVER','GOLD','PLATINUM')),
  policy_id UUID REFERENCES public.partner_grading_policies(id),
  effective_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, partner_type)
);
CREATE INDEX IF NOT EXISTS partner_type_grades_partner_idx ON public.partner_type_grades(partner_id, partner_type);
ALTER TABLE public.partner_type_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_type_grades_all" ON public.partner_type_grades;
CREATE POLICY "sr_partner_type_grades_all" ON public.partner_type_grades FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.partner_grade_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('CHANNEL','IMPLEMENTATION')),
  previous_grade TEXT NOT NULL,
  new_grade TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED','DEFERRED','DOWNGRADED','SUSPENDED')),
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_id UUID REFERENCES public.partner_grading_policies(id),
  decided_by UUID NOT NULL,
  decided_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_grade_decisions_partner_idx ON public.partner_grade_decisions(partner_id, partner_type, created_at DESC);
ALTER TABLE public.partner_grade_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_grade_decisions_all" ON public.partner_grade_decisions;
CREATE POLICY "sr_partner_grade_decisions_all" ON public.partner_grade_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.partner_grading_policy_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES public.partner_grading_policies(id),
  partner_user_id UUID REFERENCES public.partner_users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, policy_id)
);
ALTER TABLE public.partner_grading_policy_acknowledgements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_grading_ack_all" ON public.partner_grading_policy_acknowledgements;
CREATE POLICY "sr_partner_grading_ack_all" ON public.partner_grading_policy_acknowledgements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.partner_grading_policy_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.partner_grading_policies(id) ON DELETE CASCADE,
  previous_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  change_reason TEXT NOT NULL,
  changed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_grading_policy_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_grading_policy_changes_all" ON public.partner_grading_policy_changes;
CREATE POLICY "sr_partner_grading_policy_changes_all" ON public.partner_grading_policy_changes FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst,'reload schema';
