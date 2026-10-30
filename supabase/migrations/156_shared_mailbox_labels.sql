CREATE TABLE IF NOT EXISTS public.admin_mailbox_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES public.admin_mailboxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0f766e',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mailbox_id, name)
);

CREATE TABLE IF NOT EXISTS public.admin_mailbox_thread_labels (
  thread_id UUID NOT NULL REFERENCES public.admin_mailbox_threads(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.admin_mailbox_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, label_id)
);

ALTER TABLE public.admin_mailbox_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mailbox_thread_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_mailbox_labels, public.admin_mailbox_thread_labels FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_mailbox_labels, public.admin_mailbox_thread_labels TO service_role;
DROP POLICY IF EXISTS sr_admin_mailbox_labels ON public.admin_mailbox_labels;
CREATE POLICY sr_admin_mailbox_labels ON public.admin_mailbox_labels FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_admin_mailbox_thread_labels ON public.admin_mailbox_thread_labels;
CREATE POLICY sr_admin_mailbox_thread_labels ON public.admin_mailbox_thread_labels FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS admin_mailbox_thread_labels_label_idx
  ON public.admin_mailbox_thread_labels(label_id, thread_id);

NOTIFY pgrst, 'reload schema';
