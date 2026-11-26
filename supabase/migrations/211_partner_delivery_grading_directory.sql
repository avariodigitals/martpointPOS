-- Separate verified business delivery from 90-day activity monitoring.
-- Existing partner records, signed agreements and awarded grade history are preserved.
ALTER TABLE public.partner_lifecycle
  ADD COLUMN IF NOT EXISTS directory_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS directory_eligibility_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS directory_eligibility_verified_by UUID;

CREATE TABLE IF NOT EXISTS public.partner_delivery_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('channel_sale', 'implementation_acceptance', 'approved_business_delivery')),
  evidence_reference TEXT NOT NULL,
  evidence_summary TEXT NOT NULL,
  verified_by UUID NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_delivery_verifications_partner_idx
  ON public.partner_delivery_verifications(partner_id, verified_at DESC)
  WHERE approved = true;
ALTER TABLE public.partner_delivery_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_delivery_verifications_all" ON public.partner_delivery_verifications;
CREATE POLICY "sr_partner_delivery_verifications_all" ON public.partner_delivery_verifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Do not keep a partner publicly published on the basis of activity status
-- alone. Prior grade records are separate and remain untouched.
UPDATE public.partner_lifecycle
SET listing_status = 'hidden', updated_at = now(), version_counter = version_counter + 1
WHERE listing_status IN ('published', 'pending_suspension') AND directory_eligible = false;
UPDATE public.partners p
SET public_profile_enabled = false
FROM public.partner_lifecycle pl
WHERE pl.partner_id = p.id AND pl.directory_eligible = false
  AND p.public_profile_enabled = true;

-- Newly created partner records have a clear initial grade. Existing awarded
-- grades remain untouched; null historical grades become explicitly ungraded.
DO $$ DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.partners'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%current_grade%'
  LOOP
    EXECUTE format('ALTER TABLE public.partners DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.partners ALTER COLUMN current_grade SET DEFAULT 'UNGRADED';
ALTER TABLE public.partners ADD CONSTRAINT partners_current_grade_check
  CHECK (current_grade IS NULL OR current_grade IN ('UNGRADED','SILVER','GOLD','PLATINUM','DIAMOND'));
UPDATE public.partners SET current_grade = 'UNGRADED' WHERE current_grade IS NULL;
GRANT SELECT (current_grade) ON public.partners TO anon;

-- Public API/RLS visibility requires both explicit publication and verified
-- delivery eligibility.
DROP POLICY IF EXISTS "anon_partner_lifecycle_public" ON public.partner_lifecycle;
-- A legacy listing without a verified-delivery record remains out of public
-- results until an administrator reviews its evidence. Grade history is intact.
CREATE POLICY "anon_partner_lifecycle_public" ON public.partner_lifecycle FOR SELECT TO anon
  USING(directory_eligible = true AND listing_status IN ('published','pending_suspension')
    AND account_status='enabled' AND compliance_status IN ('clear','open_case','under_review'));
REVOKE ALL ON public.partner_lifecycle FROM anon, authenticated;
GRANT SELECT (partner_id, listing_status, account_status, compliance_status, directory_eligible) ON public.partner_lifecycle TO anon;
DROP POLICY IF EXISTS "anon_partners_public" ON public.partners;
CREATE POLICY "anon_partners_public" ON public.partners FOR SELECT TO anon
  USING(status='ACTIVE' AND public_profile_enabled=true AND EXISTS (
    SELECT 1 FROM public.partner_lifecycle pl WHERE pl.partner_id=partners.id
      AND pl.directory_eligible = true AND pl.listing_status IN ('published','pending_suspension')
      AND pl.account_status='enabled' AND pl.compliance_status IN ('clear','open_case','under_review')
  ));

NOTIFY pgrst,'reload schema';
