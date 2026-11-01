-- Normalize the legacy seeded display name. Only the exact old default is
-- changed; intentionally configured sender addresses and names are preserved.
UPDATE public.settings
SET data = jsonb_set(
      data,
      '{email,fromEmail}',
      to_jsonb('MartPoint <hello@martpoint.com.ng>'::text),
      false
    ),
    updated_at = now()
WHERE id = 1
  AND data #>> '{email,fromEmail}' = 'MartPoint Partners <hello@martpoint.com.ng>';

NOTIFY pgrst, 'reload schema';
