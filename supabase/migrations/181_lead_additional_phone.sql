-- Optional alternate phone number for manually managed and imported leads.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS additional_phone TEXT;

COMMENT ON COLUMN public.leads.additional_phone IS
  'Optional alternate contact phone number for the lead.';

NOTIFY pgrst, 'reload schema';
