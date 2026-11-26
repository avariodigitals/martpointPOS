-- Extend the grading framework to every approved Partner Type without
-- changing existing grade records or treating a new draft as approval.
DO $$ DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid IN ('public.partner_type_grades'::regclass, 'public.partner_grade_decisions'::regclass)
      AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%partner_type%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',
      CASE WHEN EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = c.conname AND pc.conrelid = 'public.partner_type_grades'::regclass)
        THEN 'public.partner_type_grades' ELSE 'public.partner_grade_decisions' END,
      c.conname);
  END LOOP;
END $$;

ALTER TABLE public.partner_type_grades
  ADD CONSTRAINT partner_type_grades_partner_type_check
  CHECK (partner_type IN ('REFERRAL','CHANNEL','IMPLEMENTATION','TECHNOLOGY','PAYMENT'));
ALTER TABLE public.partner_grade_decisions
  ADD CONSTRAINT partner_grade_decisions_partner_type_check
  CHECK (partner_type IN ('REFERRAL','CHANNEL','IMPLEMENTATION','TECHNOLOGY','PAYMENT'));

DO $$ DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.partner_delivery_verifications'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%delivery_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_delivery_verifications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.partner_delivery_verifications
  ADD CONSTRAINT partner_delivery_verifications_delivery_type_check
  CHECK (delivery_type IN ('channel_sale','implementation_acceptance','referral_conversion','technology_acceptance','payment_activation','approved_business_delivery'));

ALTER TABLE public.partner_grading_policies
  ALTER COLUMN criteria SET DEFAULT '{"partnerTypes":["REFERRAL","CHANNEL","IMPLEMENTATION","TECHNOLOGY","PAYMENT"],"requirements":["completed onboarding","applicable certification","satisfactory customer outcomes","satisfactory compliance","management approval","performance review"]}'::jsonb;

INSERT INTO public.partner_grading_policies(policy_reference, version, status, criteria)
VALUES (
  'MP-POL-PGP-001', '2.0', 'DRAFT',
  '{"partnerTypes":["REFERRAL","CHANNEL","IMPLEMENTATION","TECHNOLOGY","PAYMENT"],"requirements":["completed onboarding","applicable certification","satisfactory customer outcomes","satisfactory compliance","management approval","performance review"]}'::jsonb
) ON CONFLICT (policy_reference, version) DO NOTHING;

NOTIFY pgrst,'reload schema';
