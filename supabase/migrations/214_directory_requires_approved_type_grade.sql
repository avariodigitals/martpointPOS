-- Public recognition requires an approved per-Partner-Type grade record.
ALTER TABLE public.partner_type_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_partner_type_grades_recognition" ON public.partner_type_grades;
CREATE POLICY "anon_partner_type_grades_recognition" ON public.partner_type_grades FOR SELECT TO anon
  USING (current_grade IN ('SILVER','GOLD','PLATINUM'));
GRANT SELECT (partner_id, partner_type, current_grade) ON public.partner_type_grades TO anon;

DROP POLICY IF EXISTS "anon_partners_public" ON public.partners;
CREATE POLICY "anon_partners_public" ON public.partners FOR SELECT TO anon
  USING(status='ACTIVE' AND public_profile_enabled=true AND EXISTS (
    SELECT 1 FROM public.partner_lifecycle pl WHERE pl.partner_id=partners.id
      AND pl.directory_eligible = true AND pl.listing_status IN ('published','pending_suspension')
      AND pl.account_status='enabled' AND pl.compliance_status IN ('clear','open_case','under_review')
  ) AND EXISTS (
    SELECT 1 FROM public.partner_type_grades ptg WHERE ptg.partner_id=partners.id
      AND position(ptg.partner_type in partners.partner_type) > 0
      AND ptg.current_grade IN ('SILVER','GOLD','PLATINUM')
  ));
NOTIFY pgrst,'reload schema';
