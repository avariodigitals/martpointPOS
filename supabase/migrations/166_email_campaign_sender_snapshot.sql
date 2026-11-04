-- Preserve the identity a campaign actually used, even when Email Settings change.
-- Existing campaigns retain NULL: their historical sender cannot be inferred safely.
ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS from_address TEXT,
  ADD COLUMN IF NOT EXISTS reply_to TEXT,
  ADD COLUMN IF NOT EXISTS audience_name TEXT;
NOTIFY pgrst, 'reload schema';
