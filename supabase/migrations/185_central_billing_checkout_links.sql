-- Persist the server-created Paystack checkout for a Central invoice intent.
-- This allows fleet retries to reuse the same initialized checkout reference.
ALTER TABLE public.central_billing_intents
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'live';

ALTER TABLE public.central_billing_intents
  DROP CONSTRAINT IF EXISTS central_billing_intents_payment_mode_check;
ALTER TABLE public.central_billing_intents
  ADD CONSTRAINT central_billing_intents_payment_mode_check CHECK (payment_mode IN ('test','live'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_url TEXT;
