-- Keep a stable link between shared mailbox conversations and lead records.
ALTER TABLE public.admin_mailbox_threads
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS admin_mailbox_threads_lead_idx
  ON public.admin_mailbox_threads(lead_id, last_message_at DESC)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.admin_mailbox_threads.lead_id IS
  'Lead whose correspondence is represented by this mailbox conversation; used to mirror sent and received messages into lead history.';

NOTIFY pgrst, 'reload schema';
