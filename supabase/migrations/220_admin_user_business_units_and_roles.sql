-- Departmental staff classification and multiple permission roles.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS business_unit TEXT;

UPDATE public.users
SET roles = ARRAY[role]
WHERE COALESCE(array_length(roles, 1), 0) = 0 AND role IS NOT NULL;

NOTIFY pgrst, 'reload schema';
