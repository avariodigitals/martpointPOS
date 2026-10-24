-- Separate messaging for after-hours routing and an occupied-agent fallback.
-- The busy greeting is used only when every destination in the selected route
-- already has an active call attempt.

ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS voice_busy_greeting TEXT NOT NULL
    DEFAULT 'All our care agents are currently busy. Please try again later.';

-- Improve installations that still have the original generic after-hours text,
-- while preserving any greeting an administrator has already customized.
UPDATE azera_settings
SET voice_after_hours_greeting = 'Our office is currently closed. Please hold while I direct you to our after-hours support team.'
WHERE voice_after_hours_greeting = 'Thank you for calling MartPoint. Our office is currently closed. Our opening hours are Monday to Friday, 9 a.m. to 5 p.m., West Africa Time.';
