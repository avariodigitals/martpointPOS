-- Store the last-sent access details payload on the onboarding record so the
-- "Send Access Details" modal can be reopened prefilled for resends.
-- Idempotent and additive.

ALTER TABLE onboarding
  ADD COLUMN IF NOT EXISTS access_details JSONB NOT NULL DEFAULT '{}'::jsonb;
