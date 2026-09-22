-- Partner "Docs" kit categories: per-partner documents like agreements,
-- policies, certificates and QR codes shared privately to a partner.
-- Also fixes the visibility CHECK so 'PARTNER' (one specific partner) can be
-- stored — the column existed since 010/023 but the constraint rejected it.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  WHERE c.conrelid = 'partner_resources'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%category%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE partner_resources DROP CONSTRAINT IF EXISTS %I', conname);
  END IF;
END $$;

ALTER TABLE partner_resources
  ADD CONSTRAINT partner_resources_category_check
  CHECK (category IN (
    'Pricing','Product Brochures','Sales Materials','Brand Assets','Demo','Technical Guides',
    'Product Updates','Templates','Training','Certification','Branded Materials',
    'Brochure','Badge','Partner Logo','Learning Materials',
    'Agreement','Policy','Certificate','QR Code','Guide'
  ));

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  WHERE c.conrelid = 'partner_resources'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%visibility%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE partner_resources DROP CONSTRAINT IF EXISTS %I', conname);
  END IF;
END $$;

ALTER TABLE partner_resources
  ADD CONSTRAINT partner_resources_visibility_check
  CHECK (visibility IN ('ALL','TYPES','CAPABILITIES','PARTNER'));
