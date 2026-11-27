-- Track when each approved Partner Type became effective. Legacy active records
-- use their recorded partner_since value as the initial per-type activation date.
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS partner_type_activation_dates JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.partners
SET partner_type_activation_dates = COALESCE(partner_type_activation_dates, '{}'::jsonb) ||
  CASE partner_type
    WHEN 'CHANNEL_IMPLEMENTATION' THEN jsonb_build_object(
      'CHANNEL', COALESCE(partner_type_activation_dates->>'CHANNEL', partner_since::text),
      'IMPLEMENTATION', COALESCE(partner_type_activation_dates->>'IMPLEMENTATION', partner_since::text))
    WHEN 'REFERRAL' THEN jsonb_build_object('REFERRAL', COALESCE(partner_type_activation_dates->>'REFERRAL', partner_since::text))
    WHEN 'CHANNEL' THEN jsonb_build_object('CHANNEL', COALESCE(partner_type_activation_dates->>'CHANNEL', partner_since::text))
    WHEN 'IMPLEMENTATION' THEN jsonb_build_object('IMPLEMENTATION', COALESCE(partner_type_activation_dates->>'IMPLEMENTATION', partner_since::text))
    WHEN 'TECHNOLOGY' THEN jsonb_build_object('TECHNOLOGY', COALESCE(partner_type_activation_dates->>'TECHNOLOGY', partner_since::text))
    WHEN 'PAYMENT' THEN jsonb_build_object('PAYMENT', COALESCE(partner_type_activation_dates->>'PAYMENT', partner_since::text))
    ELSE '{}'::jsonb
  END
WHERE partner_since IS NOT NULL;

NOTIFY pgrst, 'reload schema';
