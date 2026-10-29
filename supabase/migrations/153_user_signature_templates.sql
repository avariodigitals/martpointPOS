-- Profile-driven email signatures. Existing custom HTML signatures remain intact.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signature_template jsonb;

COMMENT ON COLUMN public.users.signature_template IS
  'Plain editable signature fields rendered as HTML; NULL preserves a custom HTML signature. Support phone resolves from settings at send time.';
