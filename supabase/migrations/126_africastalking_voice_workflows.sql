-- Durable inbound Voice workflows: structured routing, business hours,
-- voicemail metadata, and per-destination attempts.

ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS voice_connecting_greeting TEXT NOT NULL
    DEFAULT 'Please hold while we connect you.',
  ADD COLUMN IF NOT EXISTS voice_after_hours_greeting TEXT NOT NULL
    DEFAULT 'Thank you for calling MartPoint. Our office is currently closed. Our opening hours are Monday to Friday, 9 a.m. to 5 p.m., West Africa Time.',
  ADD COLUMN IF NOT EXISTS voice_after_hours_destination TEXT,
  ADD COLUMN IF NOT EXISTS voice_timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  ADD COLUMN IF NOT EXISTS voice_weekly_schedule JSONB NOT NULL DEFAULT '{"mon":{"open":"09:00","close":"17:00"},"tue":{"open":"09:00","close":"17:00"},"wed":{"open":"09:00","close":"17:00"},"thu":{"open":"09:00","close":"17:00"},"fri":{"open":"09:00","close":"17:00"},"sat":null,"sun":null}'::jsonb,
  ADD COLUMN IF NOT EXISTS voice_closed_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS voice_menu_retry_limit INTEGER NOT NULL DEFAULT 1
    CHECK (voice_menu_retry_limit BETWEEN 0 AND 3),
  ADD COLUMN IF NOT EXISTS voice_voicemail_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_voicemail_max_seconds INTEGER NOT NULL DEFAULT 60
    CHECK (voice_voicemail_max_seconds BETWEEN 15 AND 300),
  ADD COLUMN IF NOT EXISTS voice_voicemail_retention_days INTEGER NOT NULL DEFAULT 90
    CHECK (voice_voicemail_retention_days BETWEEN 1 AND 3650),
  ADD COLUMN IF NOT EXISTS voice_greeting_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_connecting_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_no_answer_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_after_hours_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_waiting_audio_url TEXT;

UPDATE azera_settings
SET voice_greeting = 'Welcome to MartPoint, the business management software built for Nigerian businesses. Manage your sales, inventory, customer payments, and online store—all in one place. For sales, pricing, or to book a demo, press 1. For technical support, press 2. For billing, renewals, or onboarding, press 3. To hear these options again, press 9.'
WHERE voice_greeting = 'Welcome to MartPoint. Please hold while we connect you.';

ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS selected_department TEXT,
  ADD COLUMN IF NOT EXISTS final_outcome TEXT,
  ADD COLUMN IF NOT EXISTS provider_cost_amount NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS provider_cost_currency TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'new'
    CHECK (follow_up_status IN ('new', 'assigned', 'contacted', 'resolved')),
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS menu_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_provider_event_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS azera_call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  department_key TEXT,
  destination TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'dialing'
    CHECK (status IN ('dialing', 'ringing', 'answered', 'busy', 'rejected', 'no_answer', 'failed')),
  provider_state TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_call_attempts_call_idx
  ON azera_call_attempts (call_id, attempt_number);
CREATE INDEX IF NOT EXISTS azera_call_attempts_business_idx
  ON azera_call_attempts (business_id, created_at DESC);

ALTER TABLE azera_call_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_azera_call_attempts_all" ON azera_call_attempts;
CREATE POLICY "sr_azera_call_attempts_all"
  ON azera_call_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS azera_voicemails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  department_key TEXT,
  caller_phone TEXT,
  recording_url TEXT,
  recording_reference TEXT,
  recording_path TEXT,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'listened', 'resolved')),
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  follow_up_at TIMESTAMPTZ,
  retention_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_voicemails_business_idx
  ON azera_voicemails (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS azera_voicemails_status_idx
  ON azera_voicemails (business_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS azera_voicemails_recording_ref_idx
  ON azera_voicemails (call_id, recording_reference)
  WHERE recording_reference IS NOT NULL;

ALTER TABLE azera_voicemails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_azera_voicemails_all" ON azera_voicemails;
CREATE POLICY "sr_azera_voicemails_all"
  ON azera_voicemails FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Voicemail audio is private. The application issues short-lived signed URLs
-- only after the authenticated Azera permission check.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'azera-voicemails',
  'azera-voicemails',
  false,
  26214400,
  ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];

DROP POLICY IF EXISTS "sr_azera_voicemails_storage_all" ON storage.objects;
CREATE POLICY "sr_azera_voicemails_storage_all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'azera-voicemails')
  WITH CHECK (bucket_id = 'azera-voicemails');

-- Provider-played greetings must be publicly fetchable by Africa's Talking.
-- Uploads are still restricted to the server-side admin route.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'azera-voice-audio',
  'azera-voice-audio',
  true,
  10485760,
  ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];

DROP POLICY IF EXISTS "sr_azera_voice_audio_all" ON storage.objects;
CREATE POLICY "sr_azera_voice_audio_all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'azera-voice-audio')
  WITH CHECK (bucket_id = 'azera-voice-audio');

ALTER TABLE africastalking_webhook_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS africastalking_webhook_events_dedupe_idx
  ON africastalking_webhook_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
