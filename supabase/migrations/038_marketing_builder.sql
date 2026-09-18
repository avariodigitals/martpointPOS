-- Email marketing builder upgrade:
--  * public storage bucket for uploaded campaign images (must be public so
--    emails render the images in any inbox)
--  * campaign scheduling: scheduled_for + recipients_snapshot + 'scheduled' status
-- Idempotent and additive.

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recipients_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check
  CHECK (status IN ('scheduled','sending','sent','partial','failed'));

CREATE INDEX IF NOT EXISTS marketing_campaigns_scheduled_for_idx
  ON marketing_campaigns (scheduled_for) WHERE status = 'scheduled';
