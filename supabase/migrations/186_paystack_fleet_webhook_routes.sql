-- Route the single Paystack integration webhook to the fleet owning each
-- merchant subaccount transaction.
ALTER TABLE public.central_installation_mappings
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subaccount_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS central_installation_mappings_paystack_subaccount_unique
  ON public.central_installation_mappings(paystack_subaccount_code)
  WHERE paystack_subaccount_code IS NOT NULL;
