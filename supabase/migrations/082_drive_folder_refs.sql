-- ═══════════════════════════════════════════════════════════════════════════
-- GOOGLE DRIVE UPLOADS — caches the Drive folder ID for each owner scope so an
-- upload does not re-query Drive for every file.
--
-- Folder tree created under the configured root (settings.data.drive):
--
--   MartPoint Uploads/
--     ├── Business/<business_id>/
--     ├── Lead/<lead_id>/
--     ├── Partner/<partner_id>/
--     ├── Creator/<creator_id>/
--     └── Admin/<admin_id>/
--
-- `scope_key` is `<owner_type>:<folder_segment>` (e.g. "lead:8f3c…"), so the
-- folder for any owner is a single indexed lookup. Rows are upserted lazily on
-- first upload for that owner — there is no backfill needed.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.drive_folder_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('business', 'lead', 'partner', 'creator', 'admin')),
  -- "<owner_type>:<folder segment>" — one row per Drive folder we have created.
  scope_key TEXT NOT NULL UNIQUE,
  -- The Drive folder display name (owner id, or the top-level type folder name).
  folder_name TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drive_folder_refs_owner_idx ON public.drive_folder_refs (owner_type);

-- ───────────────────────────  RLS (service-role only, house style)  ───────────────────────────
ALTER TABLE public.drive_folder_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_drive_folder_refs_all" ON public.drive_folder_refs;
CREATE POLICY "sr_drive_folder_refs_all" ON public.drive_folder_refs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
