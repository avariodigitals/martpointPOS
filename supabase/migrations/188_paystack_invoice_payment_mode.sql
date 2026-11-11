ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway_mode TEXT NOT NULL DEFAULT 'live';

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_gateway_mode_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_gateway_mode_check
  CHECK (gateway_mode IN ('test','live'));
