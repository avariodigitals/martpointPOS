-- Keep audio and full transcripts in private object storage. PostgreSQL keeps
-- only paths, call summaries, and the action items needed by CRM timelines.
ALTER TABLE azera_call_summaries ADD COLUMN IF NOT EXISTS transcript_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('call-transcripts', 'call-transcripts', false, 1048576, ARRAY['text/plain'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1048576, allowed_mime_types = ARRAY['text/plain'];

DROP POLICY IF EXISTS sr_call_transcripts_service_all ON storage.objects;
CREATE POLICY sr_call_transcripts_service_all ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'call-transcripts') WITH CHECK (bucket_id = 'call-transcripts');

NOTIFY pgrst, 'reload schema';
