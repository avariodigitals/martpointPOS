-- Azera Call Recordings
-- Additive only. CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS azera_call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  recording_url TEXT NOT NULL,
  recording_path TEXT,           -- local/storage path if self-hosted
  duration_seconds INTEGER DEFAULT 0,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'audio/wav',

  recording_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (recording_type IN ('manual', 'auto', 'api')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_call_recordings_call_idx ON azera_call_recordings (call_id);
CREATE INDEX IF NOT EXISTS azera_call_recordings_business_idx ON azera_call_recordings (business_id);
CREATE INDEX IF NOT EXISTS azera_call_recordings_created_idx ON azera_call_recordings (created_at DESC);

ALTER TABLE azera_call_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_call_recordings_all" ON azera_call_recordings;
CREATE POLICY "sr_azera_call_recordings_all" ON azera_call_recordings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create storage bucket for call recordings (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  true,
  52428800, -- 50MB
  ARRAY['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to recordings
DROP POLICY IF EXISTS "sr_call_recordings_public_read" ON storage.objects;
CREATE POLICY "sr_call_recordings_public_read" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'call-recordings');

-- Allow service_role to insert/update/delete
DROP POLICY IF EXISTS "sr_call_recordings_service_all" ON storage.objects;
CREATE POLICY "sr_call_recordings_service_all" ON storage.objects
FOR ALL TO service_role USING (bucket_id = 'call-recordings');
