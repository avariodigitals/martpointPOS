CREATE TABLE IF NOT EXISTS public.admin_mailbox_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES public.admin_mailboxes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.admin_mailbox_threads(id) ON DELETE SET NULL,
  draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_mailbox_drafts_owner_idx
  ON public.admin_mailbox_drafts(mailbox_id, user_id, updated_at DESC);

ALTER TABLE public.admin_mailbox_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_mailbox_drafts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_mailbox_drafts TO service_role;
DROP POLICY IF EXISTS sr_admin_mailbox_drafts ON public.admin_mailbox_drafts;
CREATE POLICY sr_admin_mailbox_drafts ON public.admin_mailbox_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.admin_mailbox_drafts IS
  'Private per-user drafts for shared mailboxes; drafts are not shared with other mailbox members.';

NOTIFY pgrst, 'reload schema';
