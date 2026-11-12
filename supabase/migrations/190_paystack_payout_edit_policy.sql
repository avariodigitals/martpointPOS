-- Let Central control whether a fleet administrator may view or edit the
-- merchant settlement account form. This does not disable its Paystack
-- subaccount or change settlement routing.
ALTER TABLE public.central_installation_mappings
  ADD COLUMN IF NOT EXISTS allow_payout_account_edit BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
