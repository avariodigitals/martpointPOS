-- Repair migration for installations where the Azera AI voice settings
-- migration was skipped while the admin screen was already deployed.
-- Safe to run repeatedly and additive only.

ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS ai_voice_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_voice_provider TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_voice TEXT DEFAULT 'alloy';

-- Ask PostgREST to refresh its relationship/column schema cache immediately.
NOTIFY pgrst, 'reload schema';
