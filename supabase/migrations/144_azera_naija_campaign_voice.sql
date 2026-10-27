-- Optional Nigerian-language speech for Africa's Talking outbound campaigns.
ALTER TABLE azera_call_campaigns
  ADD COLUMN IF NOT EXISTS speech_provider TEXT NOT NULL DEFAULT 'africa_talking'
    CHECK (speech_provider IN ('africa_talking','naija_speech')),
  ADD COLUMN IF NOT EXISTS speech_language TEXT NOT NULL DEFAULT 'en'
    CHECK (speech_language IN ('en','ha','ig','yo')),
  ADD COLUMN IF NOT EXISTS speech_voice TEXT NOT NULL DEFAULT 'idera';

ALTER TABLE azera_call_campaign_recipients
  ADD COLUMN IF NOT EXISTS speech_audio_path TEXT;

-- Private audio is exposed to Africa's Talking only through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('azera-campaign-audio','azera-campaign-audio',false,5242880,ARRAY['audio/mpeg','audio/mp3'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['audio/mpeg','audio/mp3'];
DROP POLICY IF EXISTS sr_azera_campaign_audio_all ON storage.objects;
CREATE POLICY sr_azera_campaign_audio_all ON storage.objects FOR ALL TO service_role
  USING (bucket_id='azera-campaign-audio') WITH CHECK (bucket_id='azera-campaign-audio');

NOTIFY pgrst,'reload schema';
