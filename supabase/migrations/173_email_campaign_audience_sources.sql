-- Preserve the chosen live and saved audience sources on a campaign.
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS audience_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
