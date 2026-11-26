-- Capture the Management officer and timestamp that made a grading policy effective.
ALTER TABLE public.partner_grading_policies
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Preserve the recorded effective timestamp for policies approved before this metadata was added.
UPDATE public.partner_grading_policies
SET approved_at = effective_at
WHERE status = 'APPROVED' AND approved_at IS NULL AND effective_at IS NOT NULL;

UPDATE public.partner_grading_policies policy
SET approved_by_name = COALESCE(NULLIF(users.name, ''), users.username)
FROM public.users
WHERE policy.status = 'APPROVED' AND policy.approved_by_name IS NULL
  AND policy.approved_by = users.id;

NOTIFY pgrst,'reload schema';
