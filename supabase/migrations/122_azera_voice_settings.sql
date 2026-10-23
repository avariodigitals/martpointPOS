-- Persist the Azera settings that are already exposed by the admin screen.
-- Without these columns, AI Voice Calls could be toggled in the UI but the
-- settings API had nowhere to store them, so a refresh silently reverted them.

ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS ai_voice_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_voice_provider TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_voice TEXT DEFAULT 'alloy';
