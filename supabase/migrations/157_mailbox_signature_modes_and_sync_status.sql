ALTER TABLE public.admin_mailboxes
  ADD COLUMN IF NOT EXISTS signature_format text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;

ALTER TABLE public.admin_mailboxes
  DROP CONSTRAINT IF EXISTS admin_mailboxes_signature_format_check;

ALTER TABLE public.admin_mailboxes
  ADD CONSTRAINT admin_mailboxes_signature_format_check
  CHECK (signature_format IN ('plain', 'html'));

COMMENT ON COLUMN public.admin_mailboxes.signature_format IS
  'Controls whether signature_html contains plain text or sanitized HTML source.';
COMMENT ON COLUMN public.admin_mailboxes.last_sync_error IS
  'Most recent shared mailbox IMAP sync error, visible to mailbox members for troubleshooting.';

NOTIFY pgrst, 'reload schema';
