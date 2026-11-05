-- Private, per-user profile photos used by the Control Centre and softphone.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-avatars', 'admin-avatars', FALSE, 4194304, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = FALSE, file_size_limit = 4194304, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS sr_admin_avatars_service_all ON storage.objects;
CREATE POLICY sr_admin_avatars_service_all ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'admin-avatars') WITH CHECK (bucket_id = 'admin-avatars');

NOTIFY pgrst, 'reload schema';
