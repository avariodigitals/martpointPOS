ALTER TABLE public.admin_mailboxes
  ADD COLUMN IF NOT EXISTS signature_html text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.admin_mailboxes.signature_html IS
  'Sanitized rich-text signature applied to every message sent from this shared mailbox.';

NOTIFY pgrst, 'reload schema';
