-- Future commission schedules default to the approved payout window.
-- Existing signed schedules are preserved and are not rewritten.
ALTER TABLE public.partner_commission_schedules
  ALTER COLUMN payout_days_after_month_end SET DEFAULT 15;

COMMENT ON COLUMN public.partner_commission_schedules.payout_days_after_month_end IS
  'Compatibility column name; value means number of days after the applicable monthly commission statement is issued.';
