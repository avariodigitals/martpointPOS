-- Configurable Voice greetings and department routing for Africa's Talking.
-- voice_departments is an array of objects in this shape:
-- [{"key":"support","label":"Support","numbers":["+2348012345678"]}]

ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS voice_greeting TEXT NOT NULL
    DEFAULT 'Welcome to MartPoint. Please hold while we connect you.',
  ADD COLUMN IF NOT EXISTS voice_no_answer_greeting TEXT NOT NULL
    DEFAULT 'We are unable to answer right now. Please try again later.',
  ADD COLUMN IF NOT EXISTS voice_menu_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_departments JSONB NOT NULL DEFAULT '[]'::jsonb;
