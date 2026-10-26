-- Short-lived conversational state for Azera's public demo-booking flow.
-- The state contains only open-slot choices and booking progress; no secrets.
ALTER TABLE azera_conversations
  ADD COLUMN IF NOT EXISTS booking_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN azera_conversations.booking_state IS
  'Temporary public-chat demo booking state: available slots, selected slot and requested details.';
